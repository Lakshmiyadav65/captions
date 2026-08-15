import type { Segment } from "./types";
import { extendCaptionHolds, offsetSegments } from "./util";

/**
 * Extra lag after ASR start times. Kept at 0 — a previous 0.2s delay stacked
 * with Whisper onset-nudge and fade-in, so captions trailed the voice.
 */
export const CAPTION_SYNC_DELAY_SEC = 0;

/**
 * Preview + export clock: keep starts on the spoken word, then hold each line
 * long enough to read (into pauses, never overlapping the next caption).
 */
export function withCaptionSyncDelay(
  segments: Segment[],
  delaySec: number = CAPTION_SYNC_DELAY_SEC,
): Segment[] {
  if (!segments.length) return segments;
  const shifted = delaySec ? offsetSegments(segments, delaySec) : segments;
  return extendCaptionHolds(shifted);
}
