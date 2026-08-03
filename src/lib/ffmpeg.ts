import { spawn } from "node:child_process";
import { chmod, copyFile, mkdir, readdir, writeFile } from "node:fs/promises";
import { dirname, basename, join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

// We spawn the ffmpeg binary that ships with `ffmpeg-static` — no system install needed.
const FFMPEG: string = (ffmpegStatic as unknown as string) || "ffmpeg";

let ffmpegReady: Promise<void> | null = null;

/** Vercel (and some Linux hosts) ship the binary without +x after NFT copy. */
function ensureFfmpegExecutable(): Promise<void> {
  if (!ffmpegReady) {
    ffmpegReady =
      process.platform === "win32" || !FFMPEG || FFMPEG === "ffmpeg"
        ? Promise.resolve()
        : chmod(FFMPEG, 0o755).catch(() => undefined);
  }
  return ffmpegReady;
}

interface ExecOpts {
  allowFail?: boolean;
  signal?: AbortSignal;
  /** Working directory for the ffmpeg process (lets filters use bare relative filenames). */
  cwd?: string;
  /** Called with elapsed output seconds as ffmpeg reports `time=` (for progress UI). */
  onProgress?: (outSec: number) => void;
}

const TIME_RE = /time=(\d+):(\d+):(\d+(?:\.\d+)?)/g;

async function exec(args: string[], opts: ExecOpts = {}): Promise<string> {
  await ensureFfmpegExecutable();
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG, args, { signal: opts.signal, cwd: opts.cwd });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      const s = d.toString();
      stderr += s;
      if (opts.onProgress) {
        let m: RegExpExecArray | null;
        TIME_RE.lastIndex = 0;
        while ((m = TIME_RE.exec(s))) {
          opts.onProgress(Number(m[1]) * 3600 + Number(m[2]) * 60 + parseFloat(m[3]));
        }
      }
    });
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

const SIZE_RE = /Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/;

/** Video pixel dimensions parsed from ffmpeg's header. null if there's no video stream. */
export async function getVideoSize(
  mediaPath: string,
): Promise<{ width: number; height: number } | null> {
  const stderr = await exec(["-i", mediaPath], { allowFail: true });
  const m = SIZE_RE.exec(stderr);
  if (!m) return null;
  return { width: Number(m[1]), height: Number(m[2]) };
}

export interface AudioChunk {
  path: string;
  offsetSec: number;
  /** Actual length of this chunk in seconds (chunks may be variable-length). */
  durationSec?: number;
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

export interface BurnOptions {
  /** Directory of TTF fonts libass loads to match the subtitle font name. */
  fontsDir: string;
  signal?: AbortSignal;
  /** Progress callback: fraction 0..1 (needs totalSec to be meaningful). */
  onProgress?: (fraction: number) => void;
  totalSec?: number;
}

/**
 * Burn an ASS subtitle file into a video, producing a publish-ready MP4 with the captions
 * rendered permanently into the pixels (H.264 + AAC, faststart for web/mobile playback).
 *
 * We run ffmpeg with cwd = the work dir and reference everything by RELATIVE names:
 * `subs.ass` and a `fonts/` subdir. This deliberately avoids passing absolute paths into
 * the filtergraph — on Windows the drive-letter colon gets mangled by filter escaping and
 * libass can't find the font dir. The bundled TTFs are copied into `fonts/` (isolated from
 * the .ass so libass doesn't try to load it as a font); libass matches the ASS `Fontname`
 * against those files, so the font chosen in the editor is the font burned in.
 */
export async function burnSubtitles(
  videoPath: string,
  assContent: string,
  outPath: string,
  opts: BurnOptions,
): Promise<void> {
  const workDir = dirname(outPath);
  await writeFile(join(workDir, "subs.ass"), assContent, "utf8");

  const fontDest = join(workDir, "fonts");
  await mkdir(fontDest, { recursive: true });
  let fontCount = 0;
  try {
    for (const f of await readdir(opts.fontsDir)) {
      if (/\.(ttf|otf|ttc)$/i.test(f)) {
        await copyFile(join(opts.fontsDir, f), join(fontDest, f));
        fontCount += 1;
      }
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Caption fonts missing at ${opts.fontsDir} (${detail}). Redeploy with assets/fonts included.`,
    );
  }
  if (fontCount === 0) {
    throw new Error(
      `No TTF fonts found in ${opts.fontsDir}. Export needs assets/fonts on the server.`,
    );
  }

  // On Vercel, burn must finish inside the function time/CPU budget. Prefer speed
  // (ultrafast + slightly higher CRF) and cap long-edge at 1280 so hobby demos work.
  const onVercel = Boolean(process.env.VERCEL);
  const vf = onVercel
    ? "scale='min(1280,iw)':-2,subtitles=subs.ass:fontsdir=fonts"
    : "subtitles=subs.ass:fontsdir=fonts";

  await exec(
    [
      "-y",
      "-i", videoPath,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", onVercel ? "ultrafast" : "veryfast",
      "-crf", onVercel ? "23" : "20",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", onVercel ? "128k" : "192k",
      "-movflags", "+faststart",
      basename(outPath),
    ],
    {
      cwd: workDir,
      signal: opts.signal,
      onProgress:
        opts.onProgress && opts.totalSec
          ? (sec) => opts.onProgress!(Math.min(1, sec / opts.totalSec!))
          : undefined,
    },
  );
}
