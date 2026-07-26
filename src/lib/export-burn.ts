import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocalFile } from "@/lib/storage";
import { resolveVideoLocal } from "@/lib/storage/resolve";
import { publishExportMp4 } from "@/lib/storage/publish-export";
import { burnSubtitles, getVideoSize } from "@/lib/ffmpeg";
import { toASS, DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles";
import { fontsDir } from "@/lib/subtitles/fonts-dir";
import type { Segment } from "@/lib/transcription/types";

export interface ExportBurnInput {
  jobId: string;
  videoKey: string;
  originalName: string | null;
  durationSec: number | null;
  segments: Segment[];
  style: Partial<SubtitleStyle>;
}

export interface ExportBurnResult {
  url: string;
  filename: string;
  key: string;
}

/** Burn captions into MP4 and upload to storage. Used by API (inline) and worker (BullMQ). */
export async function burnCaptionedMp4(
  input: ExportBurnInput,
): Promise<ExportBurnResult> {
  let localVideo: LocalFile | null = null;
  let workDir: string | null = null;

  try {
    localVideo = await resolveVideoLocal(input.videoKey);
    const style: SubtitleStyle = { ...DEFAULT_STYLE, ...input.style };
    const size = await getVideoSize(localVideo.path);
    const ass = toASS(input.segments, style, size ?? undefined);
    workDir = await mkdtemp(join(tmpdir(), "captions-burn-"));
    const outPath = join(workDir, "captioned.mp4");

    await burnSubtitles(localVideo.path, ass, outPath, {
      fontsDir: fontsDir(),
      totalSec: input.durationSec ?? undefined,
    });

    const key = `exports/${input.jobId}/captioned.mp4`;
    const published = await publishExportMp4(key, outPath);
    const filename = `${(input.originalName ?? "telugu-captions").replace(/\.[^.]+$/, "")}-captioned.mp4`;
    return { url: published.url, filename, key: published.key };
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (localVideo) await localVideo.cleanup().catch(() => {});
  }
}
