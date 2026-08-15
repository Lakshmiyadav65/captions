import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocalFile } from "@/lib/storage";
import { resolveVideoLocal } from "@/lib/storage/resolve";
import { publishExportMp4 } from "@/lib/storage/publish-export";
import { burnSubtitles, getDurationSec, getVideoSize } from "@/lib/ffmpeg";
import { toASS, DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles";
import { fontsDir } from "@/lib/subtitles/fonts-dir";
import type { Segment } from "@/lib/transcription/types";
import {
  defaultExportBasename,
  exportDownloadName,
  validateExportBasename,
} from "@/lib/export-filename";
import {
  percentFromBurnFraction,
  type ExportJobStatus,
} from "@/lib/export-job";

export interface ExportBurnInput {
  jobId: string;
  videoKey: string;
  originalName: string | null;
  durationSec: number | null;
  segments: Segment[];
  style: Partial<SubtitleStyle>;
  /** Already-sanitized download name, including .mp4 */
  downloadFilename?: string;
}

export interface ExportBurnProgress {
  percent: number;
  status: Extract<ExportJobStatus, "queued" | "processing" | "finalizing">;
  renderedSec?: number;
  totalSec?: number;
}

export interface ExportBurnHooks {
  onProgress?: (update: ExportBurnProgress) => void | Promise<void>;
}

export interface ExportBurnResult {
  url: string;
  filename: string;
  key: string;
}

export function resolveExportFilename(
  requested: string | null | undefined,
  originalName: string | null | undefined,
): string {
  if (requested && requested.trim()) {
    const validated = validateExportBasename(requested);
    if (validated.ok) return validated.filename;
  }
  return exportDownloadName(defaultExportBasename(originalName));
}

/** Burn captions into MP4 and upload to storage. Used by API (inline) and worker (BullMQ). */
export async function burnCaptionedMp4(
  input: ExportBurnInput,
  hooks: ExportBurnHooks = {},
): Promise<ExportBurnResult> {
  let localVideo: LocalFile | null = null;
  let workDir: string | null = null;
  const filename = resolveExportFilename(input.downloadFilename, input.originalName);

  const report = async (update: ExportBurnProgress) => {
    await hooks.onProgress?.(update);
  };

  try {
    await report({ percent: 0, status: "queued" });
    localVideo = await resolveVideoLocal(input.videoKey);
    const style: SubtitleStyle = { ...DEFAULT_STYLE, ...input.style };
    const size = await getVideoSize(localVideo.path);
    const ass = toASS(input.segments, style, size ?? undefined);
    workDir = await mkdtemp(join(tmpdir(), "captions-burn-"));
    const outPath = join(workDir, "captioned.mp4");

    const totalSec =
      input.durationSec && input.durationSec > 0
        ? input.durationSec
        : await getDurationSec(localVideo.path);

    await report({
      percent: 5,
      status: "processing",
      renderedSec: 0,
      totalSec: totalSec || undefined,
    });

    let lastEmit = 0;
    await burnSubtitles(localVideo.path, ass, outPath, {
      fontsDir: fontsDir(),
      totalSec: totalSec || undefined,
      onProgress: (fraction) => {
        const now = Date.now();
        const percent = percentFromBurnFraction(fraction);
        if (now - lastEmit < 200 && percent < 90) return;
        lastEmit = now;
        void report({
          percent,
          status: percent >= 90 ? "finalizing" : "processing",
          renderedSec: totalSec ? fraction * totalSec : undefined,
          totalSec: totalSec || undefined,
        });
      },
    });

    await report({
      percent: 92,
      status: "finalizing",
      renderedSec: totalSec || undefined,
      totalSec: totalSec || undefined,
    });

    const key = `exports/${input.jobId}/captioned.mp4`;
    const published = await publishExportMp4(key, outPath, { filename });

    await report({
      percent: 99,
      status: "finalizing",
      renderedSec: totalSec || undefined,
      totalSec: totalSec || undefined,
    });

    return { url: published.url, filename, key: published.key };
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (localVideo) await localVideo.cleanup().catch(() => {});
  }
}
