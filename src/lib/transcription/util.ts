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
/** Higher max so phrase styles (e.g. Raj Shamani) can keep a full line on screen. */
export const WORDS_PER_FRAME_MAX = 12;
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
  return extendCaptionHolds(out);
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

/** Floor so a 1–2 word flash still has time to register. */
export const CAPTION_MIN_HOLD_SEC = 0.9;
/** Extra reading time per word (~200 wpm). */
export const CAPTION_HOLD_PER_WORD_SEC = 0.28;
export const CAPTION_MAX_HOLD_SEC = 3.2;
/** Tiny gap so consecutive frames don't overlap. */
export const CAPTION_HOLD_GAP_SEC = 0.04;

function captionWordCount(seg: Segment): number {
  if (seg.words?.length) return seg.words.length;
  return seg.text.split(/\s+/).filter(Boolean).length || 1;
}

function minHoldSec(seg: Segment): number {
  const n = captionWordCount(seg);
  return Math.min(
    CAPTION_MAX_HOLD_SEC,
    Math.max(CAPTION_MIN_HOLD_SEC, n * CAPTION_HOLD_PER_WORD_SEC),
  );
}

/**
 * Keep start times locked to speech, but hold each line long enough to read.
 * Extends `end` into pauses / up to the next caption — never delays the start,
 * and never overlaps the following line.
 */
export function extendCaptionHolds(segments: Segment[]): Segment[] {
  if (segments.length <= 1) {
    return segments.map((s) => {
      const end = Math.max(s.end, s.start + minHoldSec(s));
      return end === s.end ? s : { ...s, end };
    });
  }

  const order = segments
    .map((s, i) => i)
    .sort((a, b) => {
      const da = segments[a]!.start - segments[b]!.start;
      return da !== 0 ? da : a - b;
    });

  const ends = segments.map((s) => s.end);
  for (let k = 0; k < order.length; k++) {
    const i = order[k]!;
    const s = segments[i]!;
    const nextIdx = order[k + 1];
    const desired = Math.max(s.end, s.start + minHoldSec(s));
    if (nextIdx === undefined) {
      ends[i] = desired;
      continue;
    }
    const limit = segments[nextIdx]!.start - CAPTION_HOLD_GAP_SEC;
    // Never overlap the next line — if speech is faster than reading, cut the hold.
    ends[i] = Math.max(s.start + 0.04, Math.min(desired, limit));
  }

  return segments.map((s, i) => (ends[i] === s.end ? s : { ...s, end: ends[i]! }));
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

/**
 * After stitching a lead-in-overlapped chunk, drop content whose midpoint falls before
 * `keepFromSec` so boundary words aren't duplicated from the previous chunk.
 */
export function dropSegmentsBefore(
  segments: Segment[],
  keepFromSec: number,
): Segment[] {
  if (!keepFromSec || keepFromSec <= 0) return segments;
  const out: Segment[] = [];
  for (const s of segments) {
    const mid = (s.start + s.end) / 2;
    if (mid < keepFromSec) continue;
    if (s.end <= keepFromSec + 0.02) continue;

    if (s.words?.length) {
      const words = s.words
        .filter((w) => (w.start + w.end) / 2 >= keepFromSec)
        .map((w) => ({
          ...w,
          start: Math.max(w.start, keepFromSec),
          end: Math.max(w.end, keepFromSec + 0.05),
        }));
      if (!words.length) continue;
      out.push({
        start: words[0]!.start,
        end: Math.max(words[words.length - 1]!.end, words[0]!.start + 0.05),
        text: words.map((w) => w.text).join(" ").trim(),
        words,
      });
      continue;
    }

    out.push({
      ...s,
      start: Math.max(s.start, keepFromSec),
    });
  }
  return out;
}
