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

// Break each segment into short caption "frames" of at most `maxWords` words, so lines stay
// clean and readable (a few words on screen at a time) instead of a whole sentence wrapping
// over many rows. When word-level timings exist they drive each frame's start/end; otherwise
// the segment's span is distributed across frames proportionally to their character length.
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
    const totalChars = words.reduce((n, w) => n + w.length, 0) || 1;
    const span = Math.max(0, seg.end - seg.start);
    let t = seg.start;
    groups.forEach((g, i) => {
      const gChars = g.reduce((n, w) => n + w.length, 0);
      const end =
        i === groups.length - 1
          ? seg.end
          : Math.min(seg.end, t + (gChars / totalChars) * span);
      out.push({ start: t, end, text: g.join(" ") });
      t = end;
    });
  }
  return out;
}

// Split an array into groups of `size`, merging a lone trailing item into the previous group
// so we never emit a single-word caption frame.
function chunk<T>(arr: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < arr.length; i += size) groups.push(arr.slice(i, i + size));
  if (groups.length > 1 && groups[groups.length - 1].length === 1) {
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
