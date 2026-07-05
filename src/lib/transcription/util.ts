import type { Segment, Word } from "./types";

// Turns a flat list of timed words (what Sarvam and word-level APIs return) into
// readable subtitle lines, breaking on pauses, sentence punctuation, and length caps.

export interface GroupOptions {
  maxChars?: number;
  maxDurationSec?: number;
  gapSec?: number;
}

const SENTENCE_END = /[।॥.?!]$/;
const TIGHTEN_PUNCT = /\s+([।॥.?!,:;])/g;

export function groupWordsIntoSegments(
  words: Word[],
  opts: GroupOptions = {},
): Segment[] {
  const maxChars = opts.maxChars ?? 42;
  const maxDur = opts.maxDurationSec ?? 6;
  const gap = opts.gapSec ?? 0.6;

  const segments: Segment[] = [];
  let cur: Word[] = [];

  const flush = () => {
    if (!cur.length) return;
    const text = cur
      .map((w) => w.text)
      .join(" ")
      .replace(TIGHTEN_PUNCT, "$1")
      .trim();
    segments.push({
      start: cur[0].start,
      end: cur[cur.length - 1].end,
      text,
      words: cur.map((w) => ({ ...w })),
    });
    cur = [];
  };

  for (const w of words) {
    if (cur.length) {
      const prev = cur[cur.length - 1];
      const curText = cur.map((x) => x.text).join(" ");
      const wouldChars = curText.length + 1 + w.text.length;
      const wouldDur = w.end - cur[0].start;
      if (w.start - prev.end > gap || wouldDur > maxDur || wouldChars > maxChars) {
        flush();
      }
    }
    cur.push(w);
    if (SENTENCE_END.test(w.text)) flush();
  }
  flush();
  return segments;
}

// Fallback when a provider returns only a plain transcript (no timestamps): split into
// sentences and distribute them across the known audio duration proportional to length.
export function splitTranscriptIntoSegments(
  text: string,
  durationSec: number,
): Segment[] {
  const clean = text.trim();
  if (!clean) return [];
  const parts =
    clean.match(/[^।॥.?!]+[।॥.?!]?/g)?.map((s) => s.trim()).filter(Boolean) ?? [
      clean,
    ];
  const totalChars = parts.reduce((n, p) => n + p.length, 0) || 1;
  let t = 0;
  return parts.map((p) => {
    const dur = Math.max(0.8, (p.length / totalChars) * durationSec);
    const seg: Segment = { start: t, end: Math.min(durationSec, t + dur), text: p };
    t += dur;
    return seg;
  });
}

// Shift all timings by a fixed offset — used to stitch per-chunk results back together.
export function offsetSegments(segments: Segment[], offsetSec: number): Segment[] {
  if (!offsetSec) return segments;
  return segments.map((s) => ({
    start: s.start + offsetSec,
    end: s.end + offsetSec,
    text: s.text,
    words: s.words?.map((w) => ({
      ...w,
      start: w.start + offsetSec,
      end: w.end + offsetSec,
    })),
  }));
}
