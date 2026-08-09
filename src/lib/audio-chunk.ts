import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AudioChunk } from "./ffmpeg";

// Energy-aware audio chunking. Sarvam's sync endpoint caps at ~30s and returns no
// within-utterance timing, so subtitle lines are distributed proportionally across each
// chunk. Smaller chunks bound that drift; snapping each cut to the quietest point in a
// window keeps cuts out of the middle of words (which would hurt both text and timing).
//
// We read the 16 kHz mono 16-bit PCM WAV that extractAudio already produced and compute a
// short-time RMS envelope in-process — no extra ffmpeg pass, no dependencies. Even on
// music-heavy audio with no true silence, inter-word gaps are relative energy minima, so
// this still places cuts better than fixed intervals; on clean speech it's a big win.

export interface ChunkPlanOptions {
  /** Preferred chunk length in seconds. */
  targetSec: number;
  /** Hard maximum chunk length (e.g. the provider's per-request cap). */
  maxSec: number;
  /** Half-width of the search window (seconds) used to snap a cut to the quietest point. */
  searchSec?: number;
  /**
   * Maximum length of the final chunk. Defaults to `targetSec` so a long proportional
   * tail (old behavior allowed up to ~1.5× target) can't absorb the whole ending.
   */
  endMaxSec?: number;
  /**
   * When the remaining audio is within this many seconds of the end, switch to
   * `tailTargetSec` for tighter cuts. Defaults to `max(targetSec * 2, endMaxSec * 2)`.
   */
  tailSec?: number;
  /** Preferred chunk length near the end. Defaults to `max(5, min(endMaxSec, targetSec / 2))`. */
  tailTargetSec?: number;
}

export interface Pcm {
  sampleRate: number;
  samples: Int16Array; // mono
}

/** Parse a canonical PCM WAV (any chunk order); downmix to mono if needed. */
export function readWavPcm16(buf: Buffer): Pcm {
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("audio-chunk: not a RIFF/WAVE file");
  }
  let channels = 1;
  let sampleRate = 16000;
  let bits = 16;
  let dataOffset = -1;
  let dataLen = 0;
  let p = 12;
  while (p + 8 <= buf.length) {
    const id = buf.toString("ascii", p, p + 4);
    const size = buf.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(body + 2) || 1;
      sampleRate = buf.readUInt32LE(body + 4) || 16000;
      bits = buf.readUInt16LE(body + 14) || 16;
    } else if (id === "data") {
      dataOffset = body;
      dataLen = size;
      break;
    }
    p = body + size + (size % 2); // chunks are word-aligned
  }
  if (dataOffset < 0) throw new Error("audio-chunk: no data chunk");
  if (bits !== 16) throw new Error(`audio-chunk: expected 16-bit PCM, got ${bits}-bit`);

  const totalSamples = Math.min(dataLen, buf.length - dataOffset) >> 1;
  if (channels <= 1) {
    const samples = new Int16Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) samples[i] = buf.readInt16LE(dataOffset + i * 2);
    return { sampleRate, samples };
  }
  // Downmix interleaved multi-channel to mono.
  const frames = Math.floor(totalSamples / channels);
  const samples = new Int16Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += buf.readInt16LE(dataOffset + (f * channels + c) * 2);
    samples[f] = Math.round(sum / channels);
  }
  return { sampleRate, samples };
}

/** Encode a mono 16-bit PCM WAV from a sample slice. */
function encodeWav(samples: Int16Array, from: number, to: number, sampleRate: number): Buffer {
  const n = Math.max(0, to - from);
  const dataBytes = n * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(samples[from + i], 44 + i * 2);
  return buf;
}

/**
 * Compute chunk boundary times (seconds), including 0 and total duration. Each interior cut
 * is placed at the lowest-RMS frame within ±searchSec of the target, never past maxSec.
 *
 * Near the end of the file we switch to shorter targets (`tailTargetSec`) and never leave a
 * final chunk longer than `endMaxSec` — that bounds proportional ASR drift on the closing lines.
 */
export function planBoundaries(
  samples: Int16Array,
  sampleRate: number,
  {
    targetSec,
    maxSec,
    searchSec = 1.5,
    endMaxSec,
    tailSec,
    tailTargetSec,
  }: ChunkPlanOptions,
): number[] {
  const total = samples.length / sampleRate;
  const endCap = Math.max(3, Math.min(maxSec, endMaxSec ?? targetSec));
  const tailWindow = Math.max(endCap * 2, tailSec ?? targetSec * 2);
  const tailTarget = Math.max(
    4,
    Math.min(endCap, tailTargetSec ?? Math.max(5, targetSec * 0.5)),
  );

  if (total <= endCap * 1.25) return [0, round3(total)];

  const frameLen = Math.max(1, Math.round(0.03 * sampleRate)); // 30 ms frames
  const nFrames = Math.floor(samples.length / frameLen);
  const rms = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    let sum = 0;
    const off = f * frameLen;
    for (let i = 0; i < frameLen; i++) {
      const v = samples[off + i] / 32768;
      sum += v * v;
    }
    rms[f] = Math.sqrt(sum / frameLen);
  }
  // 3-frame (~90 ms) smoothing so we snap to a genuine low region, not a 1-frame glitch.
  const sm = new Float32Array(nFrames);
  for (let f = 0; f < nFrames; f++) {
    const a = rms[f - 1] ?? rms[f];
    const b = rms[f];
    const c = rms[f + 1] ?? rms[f];
    sm[f] = (a + b + c) / 3;
  }
  const frameSec = frameLen / sampleRate;

  const boundaries = [0];
  let start = 0;
  // Keep cutting while the remainder would exceed the final-chunk cap.
  while (total - start > endCap + 0.05) {
    const remaining = total - start;
    const nearEnd = remaining <= tailWindow;
    const effectiveTarget = Math.min(
      maxSec,
      nearEnd ? tailTarget : targetSec,
    );
    let ideal = start + effectiveTarget;
    // Prefer not to leave a stub shorter than ~half the end cap — pull the cut so the
    // final piece lands near endCap instead.
    const afterIdeal = total - ideal;
    if (afterIdeal > 0.05 && afterIdeal < endCap * 0.45) {
      ideal = total - endCap;
    }
    ideal = Math.min(ideal, start + maxSec, total - 0.05);
    ideal = Math.max(ideal, start + Math.min(effectiveTarget, endCap) * 0.4);

    const lo = Math.max(start + effectiveTarget * 0.4, ideal - searchSec);
    const hi = Math.min(
      ideal + searchSec,
      start + maxSec,
      total - Math.min(endCap * 0.35, remaining * 0.25),
    );
    let cut = Math.min(ideal, start + maxSec, total);
    if (hi > lo) {
      const fLo = Math.max(0, Math.floor(lo / frameSec));
      const fHi = Math.min(nFrames - 1, Math.ceil(hi / frameSec));
      let bestF = -1;
      let bestE = Infinity;
      for (let f = fLo; f <= fHi; f++) {
        if (sm[f] < bestE) {
          bestE = sm[f];
          bestF = f;
        }
      }
      if (bestF >= 0) cut = (bestF + 0.5) * frameSec;
    }
    cut = Math.min(cut, start + maxSec, total - 0.05);
    if (cut <= start + 0.05) {
      cut = Math.min(start + effectiveTarget, start + maxSec, total - 0.05);
    }
    if (cut <= start + 0.05 || cut >= total - 0.05) break;
    boundaries.push(round3(cut));
    start = cut;
  }
  boundaries.push(round3(total));
  return boundaries;
}

/**
 * Split a WAV into energy-aware chunks written to outDir. Returns each chunk's path and the
 * absolute time offset (seconds) of its start, for stitching segment timings back together.
 *
 * Non-first chunks include a short lead-in overlap so words straddling a cut aren't cut off
 * mid-phoneme. Callers should drop ASR content before `keepFromSec` when stitching.
 */
export async function chunkAudioByEnergy(
  wavPath: string,
  outDir: string,
  opts: ChunkPlanOptions,
): Promise<AudioChunk[]> {
  const buf = await readFile(wavPath);
  const { sampleRate, samples } = readWavPcm16(buf);
  const bounds = planBoundaries(samples, sampleRate, opts);
  await mkdir(outDir, { recursive: true });

  /** Lead-in so the ASR hears the start of words that sit on a cut. */
  const overlapSec = 0.28;
  const totalSec = samples.length / sampleRate;

  const chunks: AudioChunk[] = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const startT = bounds[i]!;
    const endT = bounds[i + 1]!;
    const audioStart =
      i === 0 ? startT : Math.max(0, startT - overlapSec);
    const audioEnd = Math.min(totalSec, endT);
    const from = Math.round(audioStart * sampleRate);
    const to = Math.round(audioEnd * sampleRate);
    const path = join(outDir, `chunk_${String(i).padStart(4, "0")}.wav`);
    await writeFile(path, encodeWav(samples, from, to, sampleRate));
    chunks.push({
      path,
      offsetSec: audioStart,
      keepFromSec: startT,
      durationSec: round3(audioEnd - audioStart),
    });
  }
  return chunks;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
