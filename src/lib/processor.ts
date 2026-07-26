import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "./config";
import { prisma } from "./db";
import { extractAudio, getDurationSec, getVideoSize } from "./ffmpeg";
import { chunkAudioByEnergy } from "./audio-chunk";
import { type LocalFile } from "./storage";
import { resolveVideoLocal } from "./storage/resolve";
import { getProvider, isLiveProvider, type Segment, type Word } from "./transcription";
import { alignWordTimings } from "./transcription/align-timings";
import { flattenWords, OpenAIProvider } from "./transcription/openai";
import { offsetSegments, splitSegmentsToMaxWords } from "./transcription/util";
import { romanizeTelugu } from "./transliterate";
import { applySpelling, BUILTIN_SPELLING } from "./spelling";
import { getUserSpellingRules } from "./spelling-server";
import { log } from "./log";
import { reportError } from "./sentry";

// Queue-agnostic transcription pipeline. Called directly by the inline queue or by the
// standalone BullMQ worker. Pulls the video from storage to a local temp file, extracts
// + chunks audio, transcribes, stitches segments, persists, and cleans up temp files.

function languageHint(): string | undefined {
  const raw = process.env.ASR_LANGUAGE ?? "te";
  return raw === "auto" || raw === "unknown" ? undefined : raw;
}

async function update(jobId: string, data: Record<string, unknown>): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data });
}

/**
 * Optional Phase 7.1 pass: run OpenAI Whisper for word timestamps and align them onto
 * primary ASR display text. No-op when TIMING_PROVIDER=none or key missing.
 * Never replaces segment text.
 */
async function maybeRefineTimings(
  segments: Segment[],
  audioPath: string,
  durationSec: number,
  workDir: string,
  jobId: string,
): Promise<Segment[]> {
  if (config.timingProvider !== "openai") return segments;
  if (!process.env.OPENAI_API_KEY) {
    log.warn("timing.skip_no_key", { jobId });
    return segments;
  }
  if (!segments.length) return segments;

  try {
    const openai = new OpenAIProvider();
    const maxChunk = openai.maxChunkSeconds ?? 600;
    const whisperWords: Word[] = [];

    if (durationSec > maxChunk * 1.5) {
      const chunkDir = join(workDir, "timing-chunks");
      const chunks = await chunkAudioByEnergy(audioPath, chunkDir, {
        targetSec: Math.min(config.chunkSeconds, maxChunk),
        maxSec: maxChunk,
        searchSec: 1.5,
      });
      for (const c of chunks) {
        const r = await openai.transcribe(c.path, {
          language: languageHint(),
          durationSec: c.durationSec,
        });
        whisperWords.push(
          ...flattenWords(r).map((w) => ({
            ...w,
            start: w.start + c.offsetSec,
            end: w.end + c.offsetSec,
          })),
        );
      }
    } else {
      const r = await openai.transcribe(audioPath, {
        language: languageHint(),
        durationSec,
      });
      whisperWords.push(...flattenWords(r));
    }

    if (!whisperWords.length) {
      log.warn("timing.skip_no_words", { jobId });
      return segments;
    }

    const refined = alignWordTimings(segments, whisperWords);
    const withWords = refined.filter((s) => s.words?.length).length;
    log.info("timing.refined", {
      jobId,
      whisperWords: whisperWords.length,
      segmentsWithWords: withWords,
      segments: refined.length,
    });
    return refined;
  } catch (err) {
    // Timing refine is best-effort — keep primary ASR text on failure.
    log.warn("timing.refine_failed", { jobId, err });
    return segments;
  }
}

export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || !job.videoKey) {
    log.warn("job.skip_missing", { jobId, hasVideo: Boolean(job?.videoKey) });
    return;
  }

  const provider = getProvider();
  const language = languageHint();
  const started = Date.now();

  let localVideo: LocalFile | null = null;
  let workDir: string | null = null;

  log.info("job.start", {
    jobId,
    userId: job.userId ?? undefined,
    provider: provider.name,
  });

  try {
    await update(jobId, {
      status: "extracting",
      progress: 5,
      provider: provider.name,
      error: null,
    });

    let segments: Segment[] = [];
    let detected = language ?? "te";

    if (!isLiveProvider(provider)) {
      await update(jobId, { status: "transcribing", progress: 50 });
      const r = await provider.transcribe("", { language });
      segments = r.segments;
      detected = r.language;
    } else {
      localVideo = await resolveVideoLocal(job.videoKey);
      workDir = await mkdtemp(join(tmpdir(), "captions-audio-"));
      const audioPath = join(workDir, "audio.wav");

      await extractAudio(localVideo.path, audioPath);
      const duration = await getDurationSec(audioPath);
      if (duration > config.limits.maxVideoSeconds) {
        throw new Error(
          `Video is too long (${Math.round(duration / 60)} min). Max ${config.limits.maxVideoMinutes} min.`,
        );
      }
      // Record the video's real pixel size so the editor + burned export use its true
      // aspect ratio (portrait/square/landscape), not a hardcoded 16:9.
      const size = await getVideoSize(localVideo.path);
      await update(jobId, {
        status: "transcribing",
        progress: 20,
        durationSec: duration,
        ...(size ? { width: size.width, height: size.height } : {}),
      });

      const maxChunkSec = provider.maxChunkSeconds ?? 0;
      // Prefer larger chunks on Vercel (fewer sequential API round-trips within maxDuration).
      // Locally keep ASR_CHUNK_SECONDS for tighter energy cuts / timing experiments.
      const preferFastChunks = Boolean(process.env.VERCEL);
      const targetChunkSec = maxChunkSec
        ? Math.min(
            preferFastChunks ? maxChunkSec : config.chunkSeconds,
            maxChunkSec,
          )
        : 0;
      // Chunk when the audio is meaningfully longer than one target chunk (else transcribe in
      // one shot). Energy-aware cuts land in relative pauses to avoid slicing mid-word.
      if (targetChunkSec && duration > targetChunkSec * 1.5) {
        const chunkDir = join(workDir, "chunks");
        const chunks = await chunkAudioByEnergy(audioPath, chunkDir, {
          targetSec: targetChunkSec,
          maxSec: maxChunkSec,
          searchSec: 1.5,
        });
        log.info("job.chunking", {
          jobId,
          chunks: chunks.length,
          targetChunkSec,
          durationSec: duration,
        });
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          // Move the bar at the start of each chunk so the UI isn't stuck at 20% during
          // the first Sarvam round-trip.
          await update(jobId, {
            progress: 20 + Math.round((i / chunks.length) * 70),
          });
          const r = await provider.transcribe(c.path, {
            language,
            durationSec: c.durationSec,
          });
          segments.push(...offsetSegments(r.segments, c.offsetSec));
          if (r.language && r.language !== "unknown") detected = r.language;
          await update(jobId, {
            progress: 20 + Math.round(((i + 1) / chunks.length) * 70),
          });
        }
      } else {
        const r = await provider.transcribe(audioPath, {
          language,
          durationSec: duration,
        });
        segments = r.segments;
        if (r.language && r.language !== "unknown") detected = r.language;
        await update(jobId, { progress: 90 });
      }

      // Phase 7.1: optional Whisper word-timestamp refine. Keeps primary ASR text.
      // Skip when OpenAI was already the primary ASR (it already requested word times).
      if (provider.name !== "openai") {
        segments = await maybeRefineTimings(
          segments,
          audioPath,
          duration,
          workDir,
          jobId,
        );
      }
    }

    // Romanize Telugu → Latin letters when configured (default). No-op for already-Latin
    // text. Words are romanized too so karaoke tokens stay aligned with the display text.
    if (config.outputMode === "translit") {
      segments = segments.map((s) => ({
        ...s,
        text: romanizeTelugu(s.text),
        words: s.words?.map((w) => ({ ...w, text: romanizeTelugu(w.text) })),
      }));
    }

    // Apply built-in corrections + the user's saved spelling rules so recurring ASR mistakes
    // come out pre-fixed. Built-ins run first; user rules can override them.
    const rules = [...BUILTIN_SPELLING, ...(await getUserSpellingRules(job.userId))];
    if (rules.length) {
      segments = segments.map((s) => ({
        ...s,
        text: applySpelling(s.text, rules),
        words: s.words?.map((w) => ({ ...w, text: applySpelling(w.text, rules) })),
      }));
    }

    // Break long lines into short, clean caption frames (a few words on screen at a time).
    if (config.maxWordsPerLine > 0) {
      segments = splitSegmentsToMaxWords(segments, config.maxWordsPerLine);
    }

    await prisma.transcript.upsert({
      where: { jobId },
      create: { jobId, language: detected, segments: JSON.stringify(segments) },
      update: { language: detected, segments: JSON.stringify(segments) },
    });
    await update(jobId, { status: "done", progress: 100, language: detected });
    log.info("job.done", {
      jobId,
      userId: job.userId ?? undefined,
      provider: provider.name,
      language: detected,
      segments: segments.length,
      durationMs: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    await update(jobId, { status: "failed", error: message.slice(0, 1000) });
    await reportError("job.failed", err, {
      jobId,
      userId: job.userId ?? undefined,
      provider: provider.name,
      durationMs: Date.now() - started,
    });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (localVideo) await localVideo.cleanup().catch(() => {});
  }
}
