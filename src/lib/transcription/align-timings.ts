import type { Segment, Word } from "./types";

// Attach Whisper (or any) word timestamps onto ASR text segments WITHOUT replacing the
// display text. Used when Sarvam owns code-mix spelling and OpenAI only supplies timings.
//
// Important: we remap onto the *global* Whisper timeline by token index, then rewrite each
// segment's start/end from its words. Window-only alignment cannot fix end-of-video lag when
// Sarvam's coarse spans were already wrong — karaoke would still light up late phrases late.

function displayTokens(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
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
  const wordsBySeg: Word[][] = segments.map(() => []);

  for (let i = 0; i < n; i++) {
    const tok = tokens[i]!;
    // Map display token i onto the Whisper word span covering the same fraction of the clip.
    const startIdx = Math.min(m - 1, Math.floor((i * m) / n));
    const endIdx = Math.min(m - 1, Math.max(startIdx, Math.floor(((i + 1) * m) / n) - 1));
    const w0 = sorted[startIdx]!;
    const w1 = sorted[endIdx]!;
    wordsBySeg[tok.segIndex]!.push({
      text: tok.text,
      start: w0.start,
      end: Math.max(w1.end, w0.start + 0.05),
    });
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

/** Ensure word times inside a segment don't go backwards after coarse index mapping. */
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
