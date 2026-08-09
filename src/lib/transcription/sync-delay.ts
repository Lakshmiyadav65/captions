import type { Segment } from "./types";
import { offsetSegments } from "./util";

/**
 * Seconds to lag on-screen captions behind raw ASR / Whisper start times.
 * Whisper marks acoustic onset; without this, frames often flash before the
 * spoken word is audible. Applied at preview + export (not stored in DB).
 */
export const CAPTION_SYNC_DELAY_SEC = 0.2;

/** Shift segment + word clocks later so captions track speech instead of leading it. */
export function withCaptionSyncDelay(
  segments: Segment[],
  delaySec: number = CAPTION_SYNC_DELAY_SEC,
): Segment[] {
  if (!delaySec || !segments.length) return segments;
  return offsetSegments(segments, delaySec);
}
