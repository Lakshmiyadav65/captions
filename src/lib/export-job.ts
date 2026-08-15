export const EXPORT_STATUSES = [
  "idle",
  "queued",
  "processing",
  "finalizing",
  "completed",
  "failed",
] as const;

export type ExportJobStatus = (typeof EXPORT_STATUSES)[number];

export const ACTIVE_EXPORT_STATUSES: readonly ExportJobStatus[] = [
  "queued",
  "processing",
  "finalizing",
];

export interface ExportProgressEvent {
  status: Exclude<ExportJobStatus, "idle">;
  progress: number;
  filename?: string;
  url?: string;
  error?: string;
  renderedSec?: number;
  totalSec?: number;
}

export function isActiveExportStatus(status: string | null | undefined): boolean {
  return ACTIVE_EXPORT_STATUSES.includes(status as ExportJobStatus);
}

/** Map ffmpeg's 0..1 burn fraction onto 5–90%, leaving room for start/upload. */
export function percentFromBurnFraction(fraction: number): number {
  const clamped = Math.min(1, Math.max(0, fraction));
  return Math.min(90, Math.max(5, Math.round(5 + clamped * 85)));
}

export function titleForExportStatus(status: ExportJobStatus): string {
  switch (status) {
    case "queued":
      return "Preparing export...";
    case "processing":
      return "Exporting your video...";
    case "finalizing":
      return "Finalizing your video...";
    case "completed":
      return "Export complete!";
    case "failed":
      return "Export failed";
    default:
      return "Export";
  }
}

export function secondaryForExportStatus(status: ExportJobStatus): string {
  switch (status) {
    case "queued":
      return "Getting your video ready...";
    case "processing":
      return "Rendering captions...";
    case "finalizing":
      return "Saving your video...";
    case "completed":
      return "Your video is ready to download.";
    case "failed":
      return "We couldn't export your video. Please try again.";
    default:
      return "";
  }
}

export function friendlyExportError(raw: string): string {
  if (/timeout|TIMED_OUT|FUNCTION_INVOCATION|canceled|AbortError|504|502/i.test(raw)) {
    return "Export timed out while burning captions. Try a shorter clip (under ~2 min), or download SRT/VTT and burn elsewhere.";
  }
  if (/ENOENT|fonts|no such file/i.test(raw)) {
    return "Export fonts/binary missing on the server. Redeploy, or download SRT/VTT as a backup.";
  }
  if (/ENOMEM|out of memory|killed|signal/i.test(raw)) {
    return "Export ran out of memory on the free host. Try a shorter/lower-res clip, or download SRT/VTT.";
  }
  if (/spawn|EACCES|permission denied|ffmpeg/i.test(raw) && /error|fail|exit/i.test(raw)) {
    return "Couldn't run the video encoder on the server. Retry once; if it keeps failing, download SRT/VTT.";
  }
  if (/already in progress|duplicate/i.test(raw)) {
    return "Export already in progress.";
  }
  return raw.slice(0, 500) || "Export failed";
}

export function formatExportClock(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
