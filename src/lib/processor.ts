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
import { sarvamRuntimeConfig } from "./transcription/sarvam";
import { offsetSegments, splitSegmentsToMaxWords, dropSegmentsBefore } from "./transcription/util";
import { romanizeTelugu } from "./transliterate";
import { applySpelling, BUILTIN_SPELLING } from "./spelling";
import { getUserSpellingRules } from "./spelling-server";
import { log } from "./log";
import { reportError } from "./sentry";
import {
  InsufficientCreditsError,
  minutesFromDurationSec,
  releaseJobCredits,
  reserveJobCredits,
} from "./credits";
import { getUserLimits, monthlyUsedMinutes } from "./quota";

// Queue-agnostic transcription pipeline. Called directly by the inline queue or by the
// standalone BullMQ worker. Pulls the video from storage to a local temp file, extracts
// + chunks audio, transcribes, stitches segments, persists, and cleans up temp files.

function isLikelyEnglish(lang: string | null | undefined): boolean {
  if (!lang) return false;
  const l = lang.toLowerCase();
  return l === "en" || l.startsWith("en-") || l === "english";
}

function languageHint(): string | undefined {
  const raw = process.env.ASR_LANGUAGE ?? "te";
  return raw === "auto" || raw === "unknown" ? undefined : raw;
}

async function update(jobId: string, data: Record<string, unknown>): Promise<void> {
  await prisma.job.update({ where: { id: jobId }, data });
}

/**
 * Optional Phase 7.1 pass: run OpenAI Whisper for word timestamps and align them onto
 * primary ASR display text (and rewrite segment start/end). No-op when
 * TIMING_PROVIDER=none or key missing. Never replaces segment text.
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
    log.warn("timing.skip_no_key", {
      jobId,
      hint: "Set OPENAI_API_KEY to enable Whisper word-timing refine",
    });
    return segments;
  }
  if (!segments.length) return segments;

  try {
    log.info("timing.refine_start", {
      jobId,
      durationSec,
      segments: segments.length,
    });
    const openai = new OpenAIProvider();
    const maxChunk = openai.maxChunkSeconds ?? 600;
    const whisperWords: Word[] = [];

    if (durationSec > maxChunk * 1.5) {
      const chunkDir = join(workDir, "timing-chunks");
      const chunks = await chunkAudioByEnergy(audioPath, chunkDir, {
        targetSec: Math.min(config.chunkSeconds, maxChunk),
        maxSec: maxChunk,
        searchSec: 1.5,
        endMaxSec: Math.min(config.chunkSeconds, maxChunk),
        tailTargetSec: Math.min(config.chunkTailSeconds, maxChunk),
      });
      for (const c of chunks) {
        const r = await openai.transcribe(c.path, {
          language: languageHint(),
          durationSec: c.durationSec,
        });
        whisperWords.push(
          ...flattenWords(r)
            .map((w) => ({
              ...w,
              start: w.start + c.offsetSec,
              end: w.end + c.offsetSec,
            }))
            .filter(
              (w) =>
                c.keepFromSec == null ||
                (w.start + w.end) / 2 >= c.keepFromSec,
            ),
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
    live: isLiveProvider(provider),
    ...(provider.name === "sarvam" ? sarvamRuntimeConfig() : {}),
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

      if (job.userId) {
        const limits = await getUserLimits(job.userId);
        const usedMinutes = await monthlyUsedMinutes(job.userId, jobId);
        try {
          await reserveJobCredits({
            userId: job.userId,
            jobId,
            videoMinutes: minutesFromDurationSec(duration),
            monthlyMinutes: limits.monthlyMinutes,
            usedMinutes,
          });
        } catch (err) {
          if (err instanceof InsufficientCreditsError) {
            throw err;
          }
          throw err;
        }
      }

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
      const tailChunkSec = Math.min(
        maxChunkSec || config.chunkTailSeconds,
        Math.max(4, config.chunkTailSeconds),
      );
      // Chunk whenever we'd exceed the provider hard limit (Sarvam = 30s). Also chunk a bit
      // earlier locally for energy cuts — but never wait until 1.25×max, which left 30–35s
      // clips unchunked on Vercel and failed with Sarvam's 30s cap.
      const chunkThreshold = maxChunkSec
        ? Math.min(maxChunkSec, targetChunkSec > 0 ? targetChunkSec * 1.25 : maxChunkSec)
        : targetChunkSec * 1.25;
      if (targetChunkSec && duration > chunkThreshold) {
        const chunkDir = join(workDir, "chunks");
        const chunks = await chunkAudioByEnergy(audioPath, chunkDir, {
          targetSec: targetChunkSec,
          maxSec: maxChunkSec,
          searchSec: 1.5,
          // Final chunk must stay on the short tail budget — never a 15–20s closing span.
          endMaxSec: tailChunkSec,
          tailSec: Math.max(targetChunkSec * 2, tailChunkSec * 3),
          tailTargetSec: tailChunkSec,
        });
        log.info("job.chunking", {
          jobId,
          chunks: chunks.length,
          targetChunkSec,
          tailChunkSec,
          chunkThreshold,
          chunkDurations: chunks.map((c) => c.durationSec),
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
          const shifted = offsetSegments(r.segments, c.offsetSec);
          segments.push(
            ...(c.keepFromSec != null
              ? dropSegmentsBefore(shifted, c.keepFromSec)
              : shifted),
          );
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

      // English uploads can mis-time under Telugu-tuned configs. When the primary auto/Sarvam
      // pass detects English and OpenAI is available, re-transcribe with OpenAI so timing/text
      // quality matches what we already rely on for timing refine.
      if (
        provider.name === "sarvam" &&
        isLikelyEnglish(detected) &&
        Boolean(process.env.OPENAI_API_KEY)
      ) {
        await update(jobId, { progress: 90 });
        log.info("job.english_fallback_openai", {
          jobId,
          detected,
          reason: "sarvam_primary_detected_english",
        });

        const openai = new OpenAIProvider();
        const openaiSegments: Segment[] = [];
        const maxChunk = openai.maxChunkSeconds ?? 600;
        const openaiThreshold = maxChunk * 1.5;

        if (duration > openaiThreshold) {
          const chunkDir = join(workDir, "openai-chunks");
          const chunks = await chunkAudioByEnergy(audioPath, chunkDir, {
            targetSec: Math.min(config.chunkSeconds, maxChunk),
            maxSec: maxChunk,
            searchSec: 1.5,
            endMaxSec: Math.min(config.chunkSeconds, maxChunk),
            tailTargetSec: Math.min(config.chunkTailSeconds, maxChunk),
          });
          for (const c of chunks) {
            const r = await openai.transcribe(c.path, {
              language: "en",
              durationSec: c.durationSec,
            });
            const shifted = offsetSegments(r.segments, c.offsetSec);
            openaiSegments.push(
              ...(c.keepFromSec != null
                ? dropSegmentsBefore(shifted, c.keepFromSec)
                : shifted),
            );
          }
        } else {
          const r = await openai.transcribe(audioPath, {
            language: "en",
            durationSec: duration,
          });
          openaiSegments.push(...r.segments);
        }

        if (openaiSegments.length > 0) {
          segments = openaiSegments;
          detected = "en";
        }
      }

      // Phase 7.1: Whisper word-timestamp refine. Keeps primary ASR text; rewrites timings.
      // Skip when OpenAI was already the primary ASR (it already requested word times).
      if (provider.name !== "openai" && !isLikelyEnglish(detected)) {
        await update(jobId, { progress: 92 });
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
    await releaseJobCredits(jobId).catch(() => {});
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
