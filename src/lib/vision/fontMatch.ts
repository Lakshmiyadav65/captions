import { TELUGU_FONTS, type FontCategory } from "@/lib/fonts";
import type { BundledFontId, StyleProfile } from "./types";

// Map a vision-described font onto exactly one of the 8 bundled Telugu fonts. libass can
// only burn those 8 TTFs, so we NEVER trust a raw font name — we score by trait keywords
// (strongest), then the model's advisory `closestBundledFont` (full weight only if its
// category agrees), then the category default, then Noto as the universal fallback.

const TRAIT_HINTS: Array<{ id: BundledFontId; kws: string[] }> = [
  { id: "mallanna", kws: ["round", "soft", "smooth", "bubbly"] },
  { id: "mandali", kws: ["friendly", "ui", "geometric", "neutral sans", "clean sans"] },
  { id: "noto", kws: ["clean", "legible", "plain", "default", "neutral", "helvetica", "arial", "roboto"] },
  { id: "ntr", kws: ["bold", "heavy", "impact", "poster", "thick", "black", "condensed", "montserrat"] },
  { id: "gidugu", kws: ["casual", "quirky", "informal", "fun", "comic"] },
  { id: "suranna", kws: ["elegant", "high-contrast", "fashion", "didone", "serif display", "playfair"] },
  { id: "ramaraja", kws: ["traditional", "bookish", "classic", "newspaper", "times", "old"] },
  { id: "dhurjati", kws: ["hand", "script", "brush", "marker", "written", "signature"] },
];

const CAT_DEFAULT: Record<FontCategory, BundledFontId> = {
  sans: "noto",
  display: "ntr",
  serif: "suranna",
  handwriting: "dhurjati",
};

const byId = (id: string) => TELUGU_FONTS.find((f) => f.id === id);

export function matchBundledFont(
  traits: string[],
  category: FontCategory,
  closest: BundledFontId,
) {
  const g = traits.join(" ").toLowerCase();
  const scores = new Map<BundledFontId, number>();
  const add = (id: BundledFontId, n: number) => scores.set(id, (scores.get(id) ?? 0) + n);

  for (const { id, kws } of TRAIT_HINTS) {
    for (const kw of kws) if (g.includes(kw)) add(id, 3);
  }
  const picked = byId(closest);
  if (picked) add(closest, picked.category === category ? 4 : 2);
  for (const f of TELUGU_FONTS) {
    if (f.category === category) add(f.id as BundledFontId, 1);
  }

  let best: BundledFontId | null = null;
  let bestScore = 0;
  for (const [id, v] of scores) if (v > bestScore) {
    bestScore = v;
    best = id;
  }
  return byId(best ?? CAT_DEFAULT[category]) ?? byId("noto")!;
}

/** The provider calls this after analyzeStyle to attach the resolved bundled font. */
export function computeFontMatch(font: StyleProfile["font"]): StyleProfile["fontMatch"] {
  const f = matchBundledFont(font.traits, font.category, font.closestBundledFont);
  const confident = f.id !== CAT_DEFAULT[font.category] || Boolean(byId(font.closestBundledFont));
  return {
    fontId: f.id as BundledFontId,
    category: f.category,
    confidence: confident ? 0.8 : 0.4,
  };
}
