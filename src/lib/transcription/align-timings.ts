import type { Segment, Word } from "./types";

// Attach Whisper (or any) word timestamps onto ASR text segments WITHOUT replacing the
// display text. Used when Sarvam owns code-mix spelling and OpenAI only supplies timings.
//
// Strategy:
// 1) Greedy sequential match of normalized display tokens → Whisper words (handles
//    Telugu/English code-mix where token counts differ).
// 2) Fill unmatched runs by interpolating between anchored neighbors on the Whisper
//    timeline (falls back to index-fraction mapping when nothing matched).
// 3) Use Whisper start times as-is. A previous 80ms onset nudge stacked with a
//    display delay and made captions trail the voice.

const START_LAG_SEC = 0;

function displayTokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u0c00-\u0c7f]+/gi, "");
}

function tokensSimilar(a: string, b: string): boolean {
  const na = normalizeToken(a);
  const nb = normalizeToken(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) {
    return true;
  }
  // Shared prefix helps romanized Telugu vs Whisper spelling drift (meeru/meeruu).
  const n = Math.min(4, na.length, nb.length);
  return n >= 3 && na.slice(0, n) === nb.slice(0, n);
}

function lagStart(start: number, end: number): number {
  if (START_LAG_SEC <= 0) return start;
  const lag = Math.min(START_LAG_SEC, Math.max(0, (end - start) * 0.25));
  return Math.min(end - 0.04, start + lag);
}

/**
 * For each text segment, map Whisper word times onto the *display* tokens
 * (Sarvam/romanized text). Never replaces `seg.text`. Updates `start`/`end` to match.
 */
export function alignWordTimings(
  segments: Segment[],
  whisperWords: Word[],
): Segment[] {
  if (!segments.length || !whisperWords.length) return segments;

  const sorted = [...whisperWords]
    .filter((w) => w.end > w.start)
    .sort((a, b) => a.start - b.start);
  if (!sorted.length) return segments;

  type Tok = { segIndex: number; text: string };
  const tokens: Tok[] = [];
  segments.forEach((seg, segIndex) => {
    for (const text of displayTokens(seg.text)) {
      tokens.push({ segIndex, text });
    }
  });
  if (!tokens.length) return segments;

  const n = tokens.length;
  const m = sorted.length;
  const assigned: Array<Word | null> = Array.from({ length: n }, () => null);

  // Greedy match display tokens onto Whisper words, advancing a cursor so we never
  // assign the same Whisper word twice out of order.
  let wi = 0;
  const window = Math.max(6, Math.ceil((m / n) * 4));
  for (let i = 0; i < n; i++) {
    const tok = tokens[i]!;
    const searchEnd = Math.min(m, wi + window);
    let best = -1;
    for (let j = wi; j < searchEnd; j++) {
      if (tokensSimilar(tok.text, sorted[j]!.text)) {
        best = j;
        break;
      }
    }
    if (best >= 0) {
      const w = sorted[best]!;
      const start = lagStart(w.start, w.end);
      assigned[i] = {
        text: tok.text,
        start,
        end: Math.max(w.end, start + 0.05),
      };
      wi = best + 1;
    }
  }

  // Fill unmatched tokens by interpolating between neighboring anchors (or by
  // fractional index across the whole Whisper span when nothing matched).
  const anchors = assigned
    .map((w, i) => (w ? i : -1))
    .filter((i) => i >= 0);
  const t0 = sorted[0]!.start;
  const t1 = sorted[m - 1]!.end;

  for (let i = 0; i < n; i++) {
    if (assigned[i]) continue;
    const tok = tokens[i]!;

    let prev = -1;
    let next = -1;
    for (const a of anchors) {
      if (a < i) prev = a;
      if (a > i && next < 0) next = a;
    }

    let start: number;
    let end: number;
    if (prev >= 0 && next >= 0) {
      const left = assigned[prev]!;
      const right = assigned[next]!;
      const count = next - prev - 1;
      const j = i - prev - 1;
      const span = Math.max(0.05, right.start - left.end);
      start = left.end + (span * j) / count;
      end = left.end + (span * (j + 1)) / count;
    } else if (prev >= 0) {
      const left = assigned[prev]!;
      const remain = n - 1 - prev;
      const j = i - prev - 1;
      const span = Math.max(0.05, t1 - left.end);
      start = left.end + (span * Math.max(0, j)) / Math.max(1, remain);
      end = left.end + (span * (Math.max(0, j) + 1)) / Math.max(1, remain);
    } else if (next >= 0) {
      const right = assigned[next]!;
      const span = Math.max(0.05, right.start - t0);
      start = t0 + (span * i) / Math.max(1, next);
      end = t0 + (span * (i + 1)) / Math.max(1, next);
    } else {
      // Nothing matched — proportional index map (legacy), with start lag.
      const startIdx = Math.min(m - 1, Math.floor((i * m) / n));
      const endIdx = Math.min(
        m - 1,
        Math.max(startIdx, Math.floor(((i + 1) * m) / n) - 1),
      );
      const w0 = sorted[startIdx]!;
      const w1 = sorted[endIdx]!;
      start = lagStart(w0.start, w1.end);
      end = Math.max(w1.end, start + 0.05);
    }

    if (end <= start) end = start + 0.05;
    assigned[i] = { text: tok.text, start, end };
  }

  const wordsBySeg: Word[][] = segments.map(() => []);
  for (let i = 0; i < n; i++) {
    const tok = tokens[i]!;
    wordsBySeg[tok.segIndex]!.push(assigned[i]!);
  }

  return segments.map((seg, i) => {
    const words = enforceMonotonic(wordsBySeg[i]!);
    if (!words.length) return { ...seg, words: undefined };
    return {
      ...seg,
      start: words[0]!.start,
      end: Math.max(words[words.length - 1]!.end, words[0]!.start + 0.05),
      words,
    };
  });
}

/** Ensure word times inside a segment don't go backwards after coarse mapping. */
function enforceMonotonic(words: Word[]): Word[] {
  if (words.length <= 1) return words;
  const out: Word[] = [{ ...words[0]! }];
  for (let i = 1; i < words.length; i++) {
    const prev = out[i - 1]!;
    let start = words[i]!.start;
    let end = words[i]!.end;
    if (start < prev.end) start = prev.end;
    if (end <= start) end = start + 0.05;
    out.push({ text: words[i]!.text, start, end });
  }
  return out;
}
