import type { Segment } from "@/lib/transcription/types";

// Pure transcript edit helpers for the power-edit UI (filler strip, split, merge).

/** Common English + romanized Telugu fillers / false starts to drop. */
const FILLERS = new Set(
  [
    "um",
    "uh",
    "uhh",
    "umm",
    "ah",
    "ahh",
    "er",
    "erm",
    "hmm",
    "hm",
    "like",
    "basically",
    "literally",
    "actually",
    "right",
    "okay",
    "ok",
    "so",
    "well",
    "youknow",
    "kinda",
    "sorta",
    "ante",
    "anta",
    "ayya",
    "ayyo",
    "arey",
    "arei",
    "endi",
    "enti",
    "aa",
    "aaa",
    "ooh",
    "oo",
  ].map((w) => w.toLowerCase()),
);

function wordCore(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Multi-word fillers matched as phrases (lowercase, spaces normalized). */
const FILLER_PHRASES = ["you know", "i mean", "kind of", "sort of"];

/**
 * Remove filler words/phrases from a line. Returns original text if nothing matched.
 */
export function stripFillersFromText(text: string): string {
  if (!text.trim()) return text;
  let out = ` ${text.replace(/\s+/g, " ").trim()} `;
  for (const phrase of FILLER_PHRASES) {
    const re = new RegExp(`\\s${phrase.replace(/ /g, "\\s+")}\\s`, "gi");
    out = out.replace(re, " ");
  }
  out = out
    .trim()
    .split(/\s+/)
    .filter((tok) => {
      const core = wordCore(tok).toLowerCase();
      return core.length > 0 && !FILLERS.has(core);
    })
    .join(" ");
  return out;
}

/** Strip fillers across all segments; drops lines that become empty. */
export function stripFillers(segments: Segment[]): Segment[] {
  return segments
    .map((s) => ({
      ...s,
      text: stripFillersFromText(s.text),
      words: s.words
        ?.map((w) => ({ ...w, text: stripFillersFromText(w.text) }))
        .filter((w) => w.text.trim().length > 0),
    }))
    .filter((s) => s.text.trim().length > 0);
}

/**
 * Split segment `i` into two at the midpoint of whitespace-separated words.
 * Timings split proportionally by word count.
 */
export function splitSegment(segments: Segment[], i: number): Segment[] {
  const seg = segments[i];
  if (!seg) return segments;
  const words = seg.text.split(/\s+/).filter(Boolean);
  if (words.length < 2) return segments;

  const mid = Math.floor(words.length / 2);
  const leftWords = words.slice(0, mid);
  const rightWords = words.slice(mid);
  const span = Math.max(0.05, seg.end - seg.start);
  const ratio = leftWords.length / words.length;
  const cut = seg.start + span * ratio;

  const left: Segment = {
    ...seg,
    text: leftWords.join(" "),
    end: cut,
    words: seg.words?.slice(0, mid),
  };
  const right: Segment = {
    start: cut,
    end: seg.end,
    text: rightWords.join(" "),
    words: seg.words?.slice(mid),
  };

  return [...segments.slice(0, i), left, right, ...segments.slice(i + 1)];
}

/** Merge segment `i` with the next segment (text + end time). */
export function mergeWithNext(segments: Segment[], i: number): Segment[] {
  const a = segments[i];
  const b = segments[i + 1];
  if (!a || !b) return segments;
  const merged: Segment = {
    start: a.start,
    end: b.end,
    text: [a.text.trim(), b.text.trim()].filter(Boolean).join(" "),
    words:
      a.words || b.words
        ? [...(a.words ?? []), ...(b.words ?? [])]
        : undefined,
  };
  return [...segments.slice(0, i), merged, ...segments.slice(i + 2)];
}
