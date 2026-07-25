// Auto keyword emphasis — shared by live overlay and ASS export so neon accent
// words (Tharun Speaks look) match in preview and burned MP4.

/** Small fillers that stay in the base caption color. */
const STOP = new Set(
  [
    "a",
    "an",
    "the",
    "to",
    "of",
    "in",
    "on",
    "at",
    "is",
    "are",
    "was",
    "were",
    "be",
    "am",
    "and",
    "or",
    "but",
    "for",
    "with",
    "from",
    "by",
    "as",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "i",
    "me",
    "my",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "they",
    "them",
    "his",
    "her",
    "not",
    "no",
    "so",
    "if",
    "do",
    "did",
    "does",
    "have",
    "has",
    "had",
    "will",
    "can",
    "just",
    "than",
    "then",
    "too",
    "very",
    "lo",
    "ki",
    "ga",
    "ni",
    "nu",
    "che",
    "ani",
    "oka",
    "okati",
    "undi",
    "unnayi",
    "ante",
    "endi",
    "entii",
    "enti",
  ].map((w) => w.toLowerCase()),
);

function stripPunct(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Whether a single display token should use the accent (highlight) color. */
export function isEmphasizedWord(word: string): boolean {
  const raw = word.trim();
  if (!raw) return false;
  const core = stripPunct(raw);
  if (!core) return false;
  const lower = core.toLowerCase();
  if (STOP.has(lower)) return false;

  // ALL CAPS short tokens (e.g. NIAT, UK)
  if (core.length >= 2 && core === core.toUpperCase() && /[A-Za-z]/.test(core)) {
    return true;
  }

  // Looks like English / proper noun (Latin letters, capital or long enough)
  if (/^[A-Za-z]+$/.test(core)) {
    if (core[0] === core[0].toUpperCase() && core.length >= 2) return true;
    if (core.length >= 3) return true;
  }

  // Longer romanized Telugu content words
  if (core.length >= 4) return true;

  return false;
}

/** Indices of words (split on whitespace) that should be emphasized. */
export function emphasizedIndices(text: string): number[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: number[] = [];
  words.forEach((w, i) => {
    if (isEmphasizedWord(w)) out.push(i);
  });
  return out;
}

export function isEmphasisOn(
  style: { emphasisMode?: "off" | "auto" | null },
): boolean {
  return (style.emphasisMode ?? "off") === "auto";
}
