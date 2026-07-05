import type { Segment } from "@/lib/transcription/types";
import type { SubtitleStyle } from "./style";
import { toSRT } from "./srt";
import { toVTT } from "./vtt";
import { toASS } from "./ass";

export * from "./style";
export { toSRT } from "./srt";
export { toVTT } from "./vtt";
export { toASS } from "./ass";

export type SubtitleFormat = "srt" | "vtt" | "ass";

export interface ExportInfo {
  ext: SubtitleFormat;
  label: string;
  mime: string;
  needsStyle: boolean;
}

export const EXPORT_FORMATS: ExportInfo[] = [
  { ext: "srt", label: "SRT", mime: "application/x-subrip", needsStyle: false },
  { ext: "vtt", label: "WebVTT", mime: "text/vtt", needsStyle: false },
  { ext: "ass", label: "ASS (styled)", mime: "text/x-ssa", needsStyle: true },
];

/** Render segments to the requested subtitle format. ASS also embeds the style. */
export function renderSubtitles(
  format: SubtitleFormat,
  segments: Segment[],
  style: SubtitleStyle,
): string {
  switch (format) {
    case "srt":
      return toSRT(segments);
    case "vtt":
      return toVTT(segments);
    case "ass":
      return toASS(segments, style);
  }
}
