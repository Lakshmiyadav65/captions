import { spawn } from "node:child_process";
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

// We spawn the ffmpeg binary that ships with `ffmpeg-static` — no system install needed.
const FFMPEG: string = (ffmpegStatic as unknown as string) || "ffmpeg";

interface ExecOpts {
  allowFail?: boolean;
  signal?: AbortSignal;
}

function exec(args: string[], opts: ExecOpts = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { signal: opts.signal });
    let stderr = "";
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0 || opts.allowFail) resolve(stderr);
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-4000)}`));
    });
  });
}

/** Decode a video's audio track to 16 kHz mono 16-bit WAV (what ASR APIs want). */
export async function extractAudio(
  videoPath: string,
  outWavPath: string,
  signal?: AbortSignal,
): Promise<void> {
  await exec(
    ["-y", "-i", videoPath, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outWavPath],
    { signal },
  );
}

const DURATION_RE = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/;

/** Media duration in seconds. Parses ffmpeg's header output (no ffprobe needed). */
export async function getDurationSec(mediaPath: string): Promise<number> {
  // `ffmpeg -i <file>` with no output prints the header (incl. Duration) then errors.
  const stderr = await exec(["-i", mediaPath], { allowFail: true });
  const m = DURATION_RE.exec(stderr);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]);
}

export interface AudioChunk {
  path: string;
  offsetSec: number;
}

/**
 * Split a WAV into fixed-length chunks (for providers with a per-request audio cap).
 * PCM WAV has no keyframes, so the segment muxer cuts exactly at `chunkSec` — the
 * offset of chunk i is therefore exactly i * chunkSec.
 */
export async function splitIntoChunks(
  wavPath: string,
  chunkSec: number,
  outDir: string,
  signal?: AbortSignal,
): Promise<AudioChunk[]> {
  await mkdir(outDir, { recursive: true });
  const pattern = join(outDir, "chunk_%04d.wav");
  await exec(
    [
      "-y", "-i", wavPath,
      "-f", "segment", "-segment_time", String(chunkSec),
      "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
      pattern,
    ],
    { signal },
  );
  const files = (await readdir(outDir))
    .filter((f) => f.startsWith("chunk_") && f.endsWith(".wav"))
    .sort();
  return files.map((f, i) => ({ path: join(outDir, f), offsetSec: i * chunkSec }));
}
