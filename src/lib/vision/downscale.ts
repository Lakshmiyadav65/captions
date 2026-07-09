import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ffmpegStatic from "ffmpeg-static";

// Re-encode an uploaded screenshot to a PNG whose long edge is <= 2576px (the vision models'
// max resolution), never upscaling. Reuses the bundled ffmpeg (no `sharp` native dependency).
// Returns a temp path + a cleanup to remove it.

const FFMPEG: string = (ffmpegStatic as unknown as string) || "ffmpeg";

export interface Downscaled {
  path: string;
  mediaType: "image/png";
  cleanup: () => Promise<void>;
}

export async function ffmpegDownscale(inputPath: string): Promise<Downscaled> {
  const dir = await mkdtemp(join(tmpdir(), "vision-"));
  const out = join(dir, "frame.png");
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(FFMPEG, [
      "-y",
      "-i", inputPath,
      "-vf", "scale='min(2576,iw)':'min(2576,ih)':force_original_aspect_ratio=decrease",
      "-frames:v", "1",
      out,
    ]);
    let err = "";
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg downscale failed: ${err.slice(-500)}`)),
    );
  });
  return {
    path: out,
    mediaType: "image/png",
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
