import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "./config";
import { prisma } from "./db";
import { extractAudio, getDurationSec, getVideoSize } from "./ffmpeg";
import { chunkAudioByEnergy } from "./audio-chunk";
import { getStorage, type LocalFile } from "./storage";
import { getProvider, isLiveProvider, type Segment } from "./transcription";
import { offsetSegments, splitSegmentsToMaxWords } from "./transcription/util";
import { romanizeTelugu } from "./transliterate";
import { applySpelling, BUILTIN_SPELLING } from "./spelling";
import { getUserSpellingRules } from "./spelling-server";

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

export async function processJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job || !job.videoKey) return;

  const provider = getProvider();
  const language = languageHint();
  const storage = getStorage();

  let localVideo: LocalFile | null = null;
  let workDir: string | null = null;

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
      localVideo = await storage.toLocalFile(job.videoKey);
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
      // Target the configured chunk length, but never exceed the provider's per-request cap.
      const targetChunkSec = maxChunkSec
        ? Math.min(config.chunkSeconds, maxChunkSec)
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
        for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown processing error";
    await update(jobId, { status: "failed", error: message.slice(0, 1000) });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (localVideo) await localVideo.cleanup().catch(() => {});
  }
}
