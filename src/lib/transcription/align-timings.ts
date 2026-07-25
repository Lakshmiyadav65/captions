import type { Segment, Word } from "./types";

// Attach Whisper (or any) word timestamps onto ASR text segments WITHOUT replacing the
// display text. Used when Sarvam owns code-mix spelling and OpenAI only supplies timings.

const PAD_SEC = 0.12;

function displayTokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/**
 * For each text segment, pick Whisper words whose midpoint falls in the segment window,
 * then map those timings onto the *display* tokens (Sarvam/romanized text).
 * Never replaces `seg.text`.
 */
export function alignWordTimings(
  segments: Segment[],
  whisperWords: Word[],
): Segment[] {
  if (!segments.length || !whisperWords.length) return segments;

  const sorted = [...whisperWords].sort((a, b) => a.start - b.start);

  return segments.map((seg) => {
    const tokens = displayTokens(seg.text);
    if (!tokens.length) return { ...seg, words: undefined };

    const winStart = seg.start - PAD_SEC;
    const winEnd = seg.end + PAD_SEC;
    const inWindow = sorted.filter((w) => {
      const mid = (w.start + w.end) / 2;
      return mid >= winStart && mid <= winEnd;
    });

    if (inWindow.length === tokens.length) {
      return {
        ...seg,
        words: tokens.map((text, i) => ({
          text,
          start: inWindow[i].start,
          end: Math.max(inWindow[i].end, inWindow[i].start + 0.05),
        })),
      };
    }

    if (inWindow.length > 0) {
      return redistributeByRelativeDurations(seg, tokens, inWindow);
    }

    // No overlapping Whisper words — even split (same as karaoke fallback).
    return evenSplitWords(seg, tokens);
  });
}

function evenSplitWords(seg: Segment, tokens: string[]): Segment {
  const span = Math.max(0.001, seg.end - seg.start);
  const step = span / tokens.length;
  return {
    ...seg,
    words: tokens.map((text, i) => ({
      text,
      start: seg.start + i * step,
      end: seg.start + (i + 1) * step,
    })),
  };
}

/** Map display tokens onto the segment span using Whisper word duration ratios. */
function redistributeByRelativeDurations(
  seg: Segment,
  tokens: string[],
  whisperInWindow: Word[],
): Segment {
  const n = tokens.length;
  const m = whisperInWindow.length;
  const span = Math.max(0.05, seg.end - seg.start);

  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    const src = whisperInWindow[Math.min(Math.floor((i * m) / n), m - 1)];
    weights.push(Math.max(0.05, src.end - src.start));
  }
  const sum = weights.reduce((a, b) => a + b, 0) || 1;

  const words: Word[] = [];
  let t = seg.start;
  for (let i = 0; i < n; i++) {
    const end =
      i === n - 1 ? seg.end : Math.min(seg.end, t + (weights[i] / sum) * span);
    words.push({ text: tokens[i], start: t, end: Math.max(end, t + 0.05) });
    t = words[i].end;
  }
  if (words.length) words[words.length - 1].end = seg.end;
  return { ...seg, words };
}
