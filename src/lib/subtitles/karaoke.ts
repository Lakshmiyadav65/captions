import type { Segment } from "@/lib/transcription/types";

// Word-by-word ("karaoke") support shared by the live overlay AND the ASS export, so the
// progressive fill you see in the preview is exactly what gets burned into the MP4.

export interface Token {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

/**
 * Split a segment's DISPLAY text into timed word tokens. When the provider gave per-word
 * timestamps that line up 1:1 with the visible words we use them; otherwise we distribute
 * the segment's time evenly. Tokenizing the *display* text (not the raw `words`) keeps the
 * timing aligned with what's shown — works for romanized + native script and every provider
 * (Sarvam has words; mock / OpenAI don't).
 */
export function tokenizeSegment(seg: Segment): Token[] {
  const words = seg.text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  if (seg.words && seg.words.length === words.length) {
    return words.map((text, i) => ({
      text,
      start: seg.words![i].start,
      end: seg.words![i].end,
    }));
  }

  const span = Math.max(0.001, seg.end - seg.start);
  const step = span / words.length;
  return words.map((text, i) => ({
    text,
    start: seg.start + i * step,
    end: seg.start + (i + 1) * step,
  }));
}

/** How many leading tokens are "filled" (already reached) at time `t` — progressive fill. */
export function filledCount(tokens: Token[], t: number): number {
  let n = 0;
  for (const tk of tokens) {
    if (t >= tk.start) n++;
    else break;
  }
  return n;
}
