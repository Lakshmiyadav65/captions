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
// sentences and distribute them across the known audio duration proportional to word count.
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
  const wordCounts = parts.map(
    (p) => Math.max(1, p.split(/\s+/).filter(Boolean).length),
  );
  const totalWords = wordCounts.reduce((n, c) => n + c, 0) || 1;
  let t = 0;
  return parts.map((p, i) => {
    const dur = Math.max(0.8, (wordCounts[i]! / totalWords) * durationSec);
    const seg: Segment = { start: t, end: Math.min(durationSec, t + dur), text: p };
    t += dur;
    return seg;
  });
}

/** Allowed range for user-customizable words-per-frame density. */
export const WORDS_PER_FRAME_MIN = 1;
export const WORDS_PER_FRAME_MAX = 6;
export const WORDS_PER_FRAME_DEFAULT = 2;

export function clampWordsPerFrame(n: number): number {
  if (!Number.isFinite(n)) return WORDS_PER_FRAME_DEFAULT;
  return Math.min(
    WORDS_PER_FRAME_MAX,
    Math.max(WORDS_PER_FRAME_MIN, Math.round(n)),
  );
}

/** Median word count across frames — used to seed the density control from a loaded transcript. */
export function estimateWordsPerFrame(segments: Segment[]): number {
  if (!segments.length) return WORDS_PER_FRAME_DEFAULT;
  const counts = segments
    .map((s) =>
      s.words?.length
        ? s.words.length
        : s.text.split(/\s+/).filter(Boolean).length,
    )
    .filter((n) => n > 0);
  if (!counts.length) return WORDS_PER_FRAME_DEFAULT;
  const sorted = [...counts].sort((a, b) => a - b);
  return clampWordsPerFrame(sorted[Math.floor(sorted.length / 2)]!);
}

// Break each segment into short caption "frames" of at most `maxWords` words, so lines stay
// clean and readable (a few words on screen at a time) instead of a whole sentence wrapping
// over many rows. When word-level timings exist they drive each frame's start/end; otherwise
// the segment's span is split evenly across frames by word count.
export function splitSegmentsToMaxWords(
  segments: Segment[],
  maxWords: number,
): Segment[] {
  if (!maxWords || maxWords <= 0) return segments;
  const out: Segment[] = [];

  for (const seg of segments) {
    // Prefer real word timings when the provider supplies them (accurate per-frame timing).
    if (seg.words && seg.words.length > maxWords) {
      for (const group of chunk(seg.words, maxWords)) {
        out.push({
          start: group[0].start,
          end: group[group.length - 1].end,
          text: group.map((w) => w.text).join(" ").trim(),
          words: group,
        });
      }
      continue;
    }

    const words = seg.text.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
      out.push(seg);
      continue;
    }

    const groups = chunk(words, maxWords);
    const span = Math.max(0, seg.end - seg.start);
    // Distribute by word count (not characters) — romanized Telugu char length
    // poorly tracks spoken duration and often makes early frames lead the audio.
    const totalWords = words.length || 1;
    let t = seg.start;
    groups.forEach((g, i) => {
      const end =
        i === groups.length - 1
          ? seg.end
          : Math.min(seg.end, t + (g.length / totalWords) * span);
      out.push({ start: t, end, text: g.join(" ") });
      t = end;
    });
  }
  return out;
}

/**
 * Re-apply a new words-per-frame density to an already-split transcript.
 * Flattens frames back to timed words, re-groups into lines, then splits
 * to `maxWords` — so raising density from 2→5 actually merges short frames.
 *
 * Grouping uses a looser pause threshold than the initial ASR pass so short
 * inter-word gaps don't defeat the user's density choice (otherwise many
 * styles look stuck at 1–2 words even when density is 4–6).
 */
export function rescaleSegmentsToMaxWords(
  segments: Segment[],
  maxWords: number,
): Segment[] {
  if (!segments.length) return segments;
  const n = clampWordsPerFrame(maxWords);
  const words = flattenSegmentWords(segments);
  if (!words.length) return segments;
  const grouped = groupWordsIntoSegments(words, {
    maxChars: Math.max(80, n * 28),
    gapSec: 1.5,
    maxDurationSec: Math.max(8, n * 2.5),
  });
  return splitSegmentsToMaxWords(grouped, n);
}

/** Flatten caption frames into a continuous timed word list (synthesizes timings when missing). */
function flattenSegmentWords(segments: Segment[]): Word[] {
  const out: Word[] = [];
  for (const seg of segments) {
    if (seg.words?.length) {
      for (const w of seg.words) {
        if (!w.text.trim()) continue;
        out.push({ start: w.start, end: w.end, text: w.text });
      }
      continue;
    }
    const toks = seg.text.split(/\s+/).filter(Boolean);
    if (!toks.length) continue;
    const span = Math.max(0, seg.end - seg.start);
    const n = toks.length || 1;
    let t = seg.start;
    toks.forEach((text, i) => {
      const end = i === toks.length - 1 ? seg.end : Math.min(seg.end, t + span / n);
      out.push({ start: t, end, text });
      t = end;
    });
  }
  return out;
}

// Split an array into groups of `size`. When size > 1, merge a lone trailing item into the
// previous group so we rarely emit a single-word leftover frame (e.g. 5 words @ size 2 → 2+3).
// When size === 1 the user asked for one word per frame — keep singletons as-is.
function chunk<T>(arr: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < arr.length; i += size) groups.push(arr.slice(i, i + size));
  if (
    size > 1 &&
    groups.length > 1 &&
    groups[groups.length - 1].length === 1
  ) {
    groups[groups.length - 2].push(groups.pop()![0]);
  }
  return groups;
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
