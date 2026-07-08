import type { StyleProfile, StyleMatch } from "./types";
import { colorAgreement } from "./color";

// Deterministic, NO-LLM similarity between two StyleProfiles (0..1). Ordinal buckets get
// adjacency partial-credit so a "l" vs "xl" size or "lower" vs "bottom" position doesn't
// tank a same-look pair; colors are compared perceptually (ΔE). Compares the resolution-
// independent profile, never the derived SubtitleStyle. Powers the ">90% -> suggest saved
// style" banner and the future multi-screenshot "Creator Style".

const bool = (x: boolean, y: boolean) => (x === y ? 1 : 0);

function ordinal<T extends string>(order: readonly T[], x: T, y: T): number {
  const i = order.indexOf(x);
  const j = order.indexOf(y);
  if (i < 0 || j < 0) return x === y ? 1 : 0;
  return 1 - Math.abs(i - j) / (order.length - 1);
}

const SIZE = ["s", "m", "l", "xl"] as const;
const POS = ["top", "middle", "lower", "bottom"] as const;
const WIDTH = ["narrow", "medium", "wide"] as const;
const TRACK = ["tight", "normal", "wide"] as const;
const OPAC = ["none", "semi", "solid"] as const;

const W = {
  font: 0.18,
  textColor: 0.2,
  layout: 0.16,
  typography: 0.14,
  background: 0.14,
  outline: 0.12,
  highlight: 0.06,
};

const isHeavy = (w: StyleProfile["font"]["weight"]) => w === "bold" || w === "black";

export function profileSimilarity(a: StyleProfile, b: StyleProfile): number {
  const fontS =
    a.fontMatch.fontId === b.fontMatch.fontId
      ? 1
      : a.fontMatch.category === b.fontMatch.category
        ? 0.5
        : 0;

  const typo =
    0.4 * bool(isHeavy(a.font.weight), isHeavy(b.font.weight)) +
    0.3 * ordinal(SIZE, a.typography.sizeBucket, b.typography.sizeBucket) +
    0.2 * ordinal(TRACK, a.typography.letterSpacing, b.typography.letterSpacing) +
    0.1 * bool(a.typography.uppercase, b.typography.uppercase);

  const layoutS =
    0.34 * bool(a.layout.align === b.layout.align, true) +
    0.4 * ordinal(POS, a.layout.positionBucket, b.layout.positionBucket) +
    0.26 * ordinal(WIDTH, a.layout.maxWidthBucket, b.layout.maxWidthBucket);

  const boxA = a.colors.backgroundOpacity !== "none";
  const boxB = b.colors.backgroundOpacity !== "none";
  const bg =
    0.4 * bool(boxA, boxB) +
    0.3 * ordinal(OPAC, a.colors.backgroundOpacity, b.colors.backgroundOpacity) +
    0.3 * (boxA && boxB ? colorAgreement(a.colors.background, b.colors.background) : boxA === boxB ? 1 : 0);

  const oA = a.outline.present;
  const oB = b.outline.present;
  const out =
    0.5 * bool(oA, oB) +
    0.5 * (oA && oB ? colorAgreement(a.colors.outline, b.colors.outline) : oA === oB ? 1 : 0);

  const kA = a.effects.karaoke;
  const kB = b.effects.karaoke;
  const hl =
    0.5 * bool(kA, kB) +
    0.5 * (kA && kB ? colorAgreement(a.colors.highlight, b.colors.highlight) : kA === kB ? 1 : 0);

  const score =
    W.font * fontS +
    W.textColor * colorAgreement(a.colors.text, b.colors.text) +
    W.layout * layoutS +
    W.typography * typo +
    W.background * bg +
    W.outline * out +
    W.highlight * hl;

  return Math.max(0, Math.min(1, Math.round(score * 1e6) / 1e6));
}

/** Best saved style at or above the threshold, or null. Skips low-confidence analyses. */
export function bestMatch(
  incoming: StyleProfile,
  saved: Array<{ id: string; name: string; profile: StyleProfile }>,
  threshold: number,
): StyleMatch | null {
  if (incoming.confidence < 0.35) return null; // don't match on a junk read
  let best: StyleMatch | null = null;
  for (const s of saved) {
    const similarity = profileSimilarity(incoming, s.profile);
    if (similarity >= threshold && (!best || similarity > best.similarity)) {
      best = { savedStyleId: s.id, name: s.name, similarity };
    }
  }
  return best;
}
