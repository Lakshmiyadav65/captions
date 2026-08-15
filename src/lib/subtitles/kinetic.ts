import { isEmphasisOn, isEmphasizedWord } from "./emphasis";

// Premium Style 1 = stacked "kinetic".
// Premium Style 2 = scattered "scatter" (up/down + big/small).
// Premium Style 3 = neon "hook" (support lines + glowing keyword).
// Premium Style 4 = "flash" (punchy scale pop on each caption frame; density sets word count).
// Premium Style 5 = "editorial" (blue sans focus + italic serif supports + accent ruler).
// Styles 3.0 = "atelier" (Klickpin elegant: mixed serif/sans, blue focus, ruler, pill, cascade).
// Styles 3.0 = "romance" animation powering the Telugu Connects preset (script + bold + trail).

export interface KineticWordPose {
  /** Multiplier on the base caption font size (1 = base). */
  scale: number;
  /** Slight horizontal nudge in em units (0 = centered). Stack mode only. */
  xEm: number;
}

export interface ScatterWordPose {
  /** Multiplier on the base caption font size (1 = base). */
  scale: number;
  /** Horizontal offset from caption center, as % of video width. */
  xPct: number;
  /** Vertical offset from caption anchor, as % of video height. */
  yPct: number;
}

/**
 * Premium Style 1 — vertical stack. Focus word large; others ~0.58× with a light side nudge.
 */
export function kineticPoses(wordCount: number, focus = 0): KineticWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  if (n === 1) {
    return [{ scale: 1.15, xEm: 0 }];
  }

  return Array.from({ length: n }, (_, i) => {
    const isFocus = i === f;
    const side = i % 2 === 0 ? -0.15 : 0.15;
    return {
      scale: isFocus ? 1.2 : 0.58,
      xEm: isFocus ? 0 : side,
    };
  });
}

/**
 * Premium Style 2 — Klickpin scatter. Words sit at different X/Y with size hierarchy.
 * Vertical gaps stay tight so pairs like "on my" / "podcast" nearly touch (reference look).
 */
export function scatterPoses(wordCount: number, focus = 0): ScatterWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  if (n === 1) {
    return [{ scale: 1.2, xPct: 0, yPct: 0 }];
  }

  if (n === 2) {
    // Focus first: diagonal "that" / "every". Focus second: tight stack "on my" / "podcast".
    return f === 0
      ? [
          { scale: 1.22, xPct: -9, yPct: -2.0 },
          { scale: 0.52, xPct: 11, yPct: 2.4 },
        ]
      : [
          { scale: 0.5, xPct: 0, yPct: -2.8 },
          { scale: 1.22, xPct: 0, yPct: 2.2 },
        ];
  }

  if (n === 3) {
    // "you" / "know" / "the one" — compact scatter.
    const base: ScatterWordPose[] = [
      { scale: 1.0, xPct: -10, yPct: -4.5 },
      { scale: 0.48, xPct: 12, yPct: -0.5 },
      { scale: 1.1, xPct: -4, yPct: 4.0 },
    ];
    return base.map((p, i) =>
      i === f
        ? { ...p, scale: Math.max(p.scale, 1.18) }
        : { ...p, scale: Math.min(p.scale, 0.55) },
    );
  }

  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const isFocus = i === f;
    return {
      scale: isFocus ? 1.15 : col === 0 ? 0.6 : 0.48,
      xPct: col === 0 ? -10 - row : 10 + row,
      yPct: (row - 1) * 4.5 + (col === 0 ? -2 : 2.5),
    };
  });
}

/** Active word index from filled count (last spoken word), clamped. */
export function kineticFocusIndex(tokenCount: number, filled: number): number {
  if (tokenCount <= 0) return 0;
  if (filled <= 0) return 0;
  return Math.min(tokenCount - 1, filled - 1);
}

export function isKinetic(style: { animation?: string }): boolean {
  return style.animation === "kinetic";
}

export function isScatter(style: { animation?: string }): boolean {
  return style.animation === "scatter";
}

export function isHook(style: { animation?: string }): boolean {
  return style.animation === "hook";
}

export function isFlash(style: { animation?: string }): boolean {
  return style.animation === "flash";
}

export function isEditorial(style: { animation?: string }): boolean {
  return style.animation === "editorial";
}

export function isAtelier(style: { animation?: string }): boolean {
  return style.animation === "atelier";
}

export function isRomance(style: { animation?: string }): boolean {
  return style.animation === "romance";
}

export function isShamani(style: { animation?: string }): boolean {
  return style.animation === "shamani";
}

export function isPinterest(style: { animation?: string }): boolean {
  return style.animation === "pinterest";
}

/** High-contrast editorial serif from the Pinterest 2 reference. */
export const PINTEREST_FONT = "Instrument Serif";
/** Lead-in line vs oversized hero word. */
export const PINTEREST_SUPPORT_SCALE = 0.38;
const PINTEREST_WEAK =
  /^(a|an|and|as|at|be|but|by|do|for|if|in|is|it|it's|its|me|my|not|of|on|or|so|the|to|up|us|we|you)$/i;

/**
 * Pinterest 2 lockup: small lowercase lead-in above a much larger hero.
 * 1–2 words → hero only. 3–5 → last word hero. 6+ → last 2 (or 3 if the last is weak).
 */
export function pinterestLockup(words: string[]): { support: number[]; hero: number[] } {
  const n = words.length;
  if (n <= 0) return { support: [], hero: [] };
  if (n === 1) return { support: [], hero: [0] };
  if (n === 2) return { support: [0], hero: [1] };

  let heroCount = n >= 6 ? 2 : 1;
  if (PINTEREST_WEAK.test(words[n - 1]!) && n >= 3) {
    heroCount = Math.min(n - 1, heroCount + 1);
  }
  heroCount = Math.min(heroCount, n - 1);
  const start = n - heroCount;
  return {
    support: Array.from({ length: start }, (_, i) => i),
    hero: Array.from({ length: heroCount }, (_, i) => start + i),
  };
}

export function pinterestFitScale(args: {
  support: string;
  hero: string;
  baseFontPx: number;
  maxWidthPx: number;
}): number {
  const heroFs = args.baseFontPx;
  const supportFs = args.baseFontPx * PINTEREST_SUPPORT_SCALE;
  let s = captionFitScale(args.hero, heroFs, args.maxWidthPx, 0.52);
  if (args.support) {
    s = Math.min(s, captionFitScale(args.support, supportFs, args.maxWidthPx, 0.48));
  }
  return Math.max(0.55, s);
}

export function isPinterest3(style: { animation?: string }): boolean {
  return style.animation === "pinterest3";
}

/** Bold grotesque for the Pinterest 3 staggered lockup. */
export const PINTEREST3_FONT = "Inter";
export const PINTEREST3_SUPPORT_SCALE = 0.4;
export const PINTEREST3_AFTER_SCALE = 0.46;
const PINTEREST3_LEAD = /^(a|an|the)$/i;
const PINTEREST3_TRAIL = /^(me|it|up|on|out)$/i;

export type Pinterest3Lockup = {
  before: number[];
  hero: number[];
  after: number[];
  /** Short word over a huge faded keyword (e.g. In / difficult). */
  ghost: boolean;
};

/**
 * Pinterest 3: longest/interior word is the huge hero; leftover words stagger
 * above-left and below-right. "a story" / "tell me" stay glued to the hero.
 */
export function pinterest3Lockup(words: string[]): Pinterest3Lockup {
  const n = words.length;
  if (n <= 0) return { before: [], hero: [], after: [], ghost: false };
  if (n === 1) return { before: [], hero: [0], after: [], ghost: false };
  if (n === 2) {
    const a = words[0]!.length;
    const b = words[1]!.length;
    if (a <= 3 && b >= 6) {
      return { before: [0], hero: [1], after: [], ghost: true };
    }
    if (a >= b) {
      return { before: [], hero: [0], after: [1], ghost: false };
    }
    return { before: [0], hero: [1], after: [], ghost: false };
  }

  let best = n - 1;
  let bestScore = -1;
  for (let i = 0; i < n; i++) {
    let s = words[i]!.replace(/[^a-zA-Z]/g, "").length;
    if (i > 0 && i < n - 1) s += 1.6;
    if (s >= bestScore) {
      bestScore = s;
      best = i;
    }
  }
  let start = best;
  let end = best;
  if (start > 0 && PINTEREST3_LEAD.test(words[start - 1]!)) start -= 1;
  if (end < n - 1 && PINTEREST3_TRAIL.test(words[end + 1]!)) end += 1;
  return {
    before: Array.from({ length: start }, (_, i) => i),
    hero: Array.from({ length: end - start + 1 }, (_, i) => start + i),
    after: Array.from({ length: n - end - 1 }, (_, i) => end + 1 + i),
    ghost: false,
  };
}

export function pinterest3FitScale(args: {
  before: string;
  hero: string;
  after: string;
  baseFontPx: number;
  maxWidthPx: number;
}): number {
  const heroFs = args.baseFontPx;
  let s = captionFitScale(args.hero, heroFs, args.maxWidthPx, 0.56);
  if (args.before) {
    s = Math.min(
      s,
      captionFitScale(args.before, heroFs * PINTEREST3_SUPPORT_SCALE, args.maxWidthPx, 0.52),
    );
  }
  if (args.after) {
    s = Math.min(
      s,
      captionFitScale(args.after, heroFs * PINTEREST3_AFTER_SCALE, args.maxWidthPx, 0.52),
    );
  }
  return Math.max(0.55, s);
}

export function isPinterest4(style: { animation?: string }): boolean {
  return style.animation === "pinterest4";
}

/** Mixed grotesque + italic editorial serif (Pinterest 4). */
export const PINTEREST4_SANS = "Inter";
export const PINTEREST4_SERIF = "Instrument Serif";
export const PINTEREST4_SUPPORT_SCALE = 0.62;
export const PINTEREST4_AFTER_SCALE = 0.58;
export const PINTEREST4_HERO_SCALE = 1.12;
/** Serif italic punch only for a long interior word (e.g. "performing"). */
export const PINTEREST4_SERIF_MIN_CHARS = 8;

export type Pinterest4Lockup = {
  before: number[];
  hero: number[];
  after: number[];
  /** Serif italic hero when the phrase is long enough to mix type. */
  serifHero: boolean;
};

/**
 * Pinterest 4: short phrases stay bold sans; 3+ words mix a serif italic punch
 * in the middle (e.g. "But my best" / performing / "viral videos").
 */
export function pinterest4Lockup(words: string[]): Pinterest4Lockup {
  const n = words.length;
  const letters = (i: number) => words[i]!.replace(/[^a-zA-Z]/g, "").length;
  if (n <= 0) return { before: [], hero: [], after: [], serifHero: false };
  if (n <= 2) {
    return {
      before: [],
      hero: Array.from({ length: n }, (_, i) => i),
      after: [],
      serifHero: false,
    };
  }
  if (n === 3) {
    return { before: [0, 1], hero: [2], after: [], serifHero: false };
  }

  let best = 1;
  let bestScore = -1;
  for (let i = 1; i < n - 1; i++) {
    const s = letters(i);
    if (s >= bestScore) {
      bestScore = s;
      best = i;
    }
  }
  return {
    before: Array.from({ length: best }, (_, i) => i),
    hero: [best],
    after: Array.from({ length: n - best - 1 }, (_, i) => best + 1 + i),
    serifHero: letters(best) >= PINTEREST4_SERIF_MIN_CHARS,
  };
}

export function pinterest4FitScale(args: {
  before: string;
  hero: string;
  after: string;
  baseFontPx: number;
  maxWidthPx: number;
}): number {
  const compact = !args.before && !args.after;
  const heroFs = args.baseFontPx * (compact ? 1 : PINTEREST4_HERO_SCALE);
  let s = captionFitScale(args.hero, heroFs, args.maxWidthPx, args.hero ? 0.5 : 0.56);
  if (args.before) {
    s = Math.min(
      s,
      captionFitScale(args.before, args.baseFontPx * PINTEREST4_SUPPORT_SCALE, args.maxWidthPx, 0.56),
    );
  }
  if (args.after) {
    s = Math.min(
      s,
      captionFitScale(args.after, args.baseFontPx * PINTEREST4_AFTER_SCALE, args.maxWidthPx, 0.56),
    );
  }
  return Math.max(0.55, s);
}

/** Caps line uses the Negative preset typeface (Anton). */
export const SHAMANI_HEADER_FONT = "Anton";
/** Neutral sans for the lowercase line. */
export const SHAMANI_BODY_FONT = "Inter";
/** Caps line is always this many words when the phrase is long enough. */
export const SHAMANI_HEADER_WORDS = 4;
/** Lowercase line — a bit under the caps, but large enough to read. */
export const SHAMANI_BODY_SCALE = 0.64;
/** Horizontal focus band — captions must stay inside this % of frame width. */
export const SHAMANI_FOCUS_WIDTH_PCT = 80;
/** Trail speech so each word stays readable — keep this tiny so it doesn't feel late. */
export const SHAMANI_REVEAL_LAG_SEC = 0.06;

/** Caps line is always 4 words (or fewer only if the phrase is shorter). */
export function shamaniHeaderCount(tokenCount: number): number {
  const n = Math.max(0, tokenCount);
  return Math.min(SHAMANI_HEADER_WORDS, n);
}

/**
 * Raj Shamani reveal: first 4 words are the caps header and lock;
 * remaining words appear on the lowercase line only once spoken.
 */
export function shamaniReveal(tokenCount: number, filled: number): {
  headerCount: number;
  headerShown: number;
  bodyShown: number;
} {
  const n = Math.max(0, tokenCount);
  const headerCount = shamaniHeaderCount(n);
  const shown = Math.min(Math.max(filled, 0), n);
  return {
    headerCount,
    headerShown: Math.min(shown, headerCount),
    bodyShown: Math.max(0, shown - headerCount),
  };
}

/** Word fill that trails speech, but still lands the last words before the phrase ends. */
export function shamaniFilledAt(
  tokens: { start: number }[],
  t: number,
  segEnd: number,
): number {
  if (!tokens.length) return 0;
  const last = tokens[tokens.length - 1]!;
  const catchUpBy = Math.max(last.start, segEnd - 0.18);
  const lagT = t >= catchUpBy ? t : t - SHAMANI_REVEAL_LAG_SEC;
  let n = 0;
  for (const tk of tokens) {
    if (lagT >= tk.start) n++;
    else break;
  }
  return n;
}

/**
 * Shrink only enough to keep the finished lockup inside the 80% focus band.
 * P0 = focus area, P1 = font size.
 */
export function shamaniFitScale(args: {
  header: string;
  body: string;
  baseFontPx: number;
  maxWidthPx: number;
}): number {
  const headerFs = args.baseFontPx;
  const bodyFs = args.baseFontPx * SHAMANI_BODY_SCALE;
  // Oswald is condensed; Inter is wider — estimate both finished lines.
  let s = captionFitScale(args.header, headerFs, args.maxWidthPx, 0.58);
  if (args.body) {
    s = Math.min(s, captionFitScale(args.body, bodyFs, args.maxWidthPx, 0.58));
  }
  return Math.max(0.55, s);
}

/** Premium modes that need per-word fill tracking. */
export function isKineticMode(style: { animation?: string }): boolean {
  return (
    isKinetic(style) ||
    isScatter(style) ||
    isHook(style) ||
    isEditorial(style) ||
    isAtelier(style) ||
    isShamani(style) ||
    isPinterest(style) ||
    isPinterest3(style) ||
    isPinterest4(style)
  );
}

/** Scale bump for the flash caption punch. */
export const FLASH_SCALE = 1.25;

/**
 * Premium Style 5 — editorial slices (Klickpin watch/blue studio look):
 * italic serif supports above (left-staggered) + large blue sans focus +
 * italic serif trail below-right.
 */
export function editorialLayout(tokenCount: number, focus = 0): {
  before: number[];
  focus: number;
  after: number[];
} {
  const n = Math.max(1, tokenCount);
  const f = ((focus % n) + n) % n;
  return {
    before: Array.from({ length: f }, (_, i) => i),
    focus: f,
    after: Array.from({ length: n - f - 1 }, (_, i) => f + 1 + i),
  };
}

export const EDITORIAL_FOCUS_SCALE = 1.28;
export const EDITORIAL_SATELLITE_SCALE = 0.46;
export const EDITORIAL_SATELLITE_FONT = "Instrument Serif";

/**
 * Styles 3.0 — Atelier layout variants (from Klickpin elegant self-care reference).
 * Switches composition as speech advances so captions feel designed, not static.
 */
export type AtelierVariant = "pill" | "cascade" | "overlap" | "stack" | "roll";

export function atelierVariant(tokenCount: number, focus = 0): AtelierVariant {
  const n = Math.max(1, tokenCount);
  const f = ((focus % n) + n) % n;
  if (n === 1) return "pill";
  if (n === 2) return f === 0 ? "cascade" : "stack";
  if (f === 0) return "cascade";
  if (f === n - 1 && n >= 3) return "roll";
  if (n >= 3 && f > 0 && f < n - 1) return "overlap";
  return "stack";
}

/** Same focus slicing as editorial — spoken word is the large blue sans. */
export function atelierLayout(tokenCount: number, focus = 0) {
  return editorialLayout(tokenCount, focus);
}

export const ATELIER_FOCUS_SCALE = 1.42;
export const ATELIER_SATELLITE_SCALE = 0.42;
export const ATELIER_ROLL_SCALE = 0.72;
export const ATELIER_SATELLITE_FONT = "Instrument Serif";

export type RomanceLockup = {
  before: number[];
  focus: number;
  after: number[];
  /** How to render `after` — script under the hero, or tracked uppercase trail. */
  afterStyle: "script" | "trail";
  /** Single-word frames: script-only ("neekuadhi") vs bold hero ("Dabbulu"). */
  solo: "script" | "sans" | null;
};

const ROMANCE_STOP = new Set(
  [
    "a", "an", "the", "to", "of", "in", "on", "at", "is", "are", "and", "or",
    "for", "with", "from", "by", "as", "it", "if", "so", "lo", "ki", "ga",
    "ni", "nu", "ee", "aa", "che", "oka",
  ].map((w) => w.toLowerCase()),
);

function romanceCore(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Strip wrapping punctuation so “Credits,” doesn’t sit on the hero. */
export function romanceDisplayWord(word: string): string {
  return romanceCore(word) || word;
}

/** Pick the keyword the reference would set in the big sans — not “whatever is in the middle”. */
export function romanceFocusIndex(texts: string[]): number {
  const n = texts.length;
  if (n <= 1) return 0;
  let best = 0;
  let bestScore = -Infinity;
  texts.forEach((raw, i) => {
    const core = romanceCore(raw);
    const lower = core.toLowerCase();
    let s = core.length * 2;
    if (ROMANCE_STOP.has(lower)) s -= 24;
    if (core.length <= 2) s -= 12;
    if (isEmphasizedWord(raw)) s += 10;
    if (/^[A-Za-z]+$/.test(core) && core[0] === core[0].toUpperCase()) s += 8;
    if (core.length >= 2 && core === core.toUpperCase() && /[A-Za-z]/.test(core)) s += 6;
    if (s > bestScore || (s === bestScore && core.length > romanceCore(texts[best]!).length)) {
      best = i;
      bestScore = s;
    }
  });
  return best;
}

/**
 * Styles 3.0 — Telugu Connects lockup (Don’t-fall-in-love reference):
 *
 * Upper  = script (Great Vibes), lowercase, sits on the hero
 * Middle = one bold sans keyword (never repeated)
 * Lower  = tracked uppercase trail when words follow the hero
 *
 * 1 word  → script-only if it’s a short connector; otherwise bold
 * 2 words → script + bold (script above if the hero is last, below if the hero is first)
 * 3+      → words before hero = script, hero = bold, words after = trail
 */
export function romanceLockup(texts: string[]): RomanceLockup {
  const n = Math.max(1, texts.length);
  if (n === 1) {
    const core = romanceCore(texts[0] ?? "");
    const scriptSolo = core.length <= 3 || ROMANCE_STOP.has(core.toLowerCase());
    return {
      before: [],
      focus: 0,
      after: [],
      afterStyle: "script",
      solo: scriptSolo ? "script" : "sans",
    };
  }
  const focus = romanceFocusIndex(texts);
  const before = Array.from({ length: focus }, (_, i) => i);
  const after = Array.from({ length: n - focus - 1 }, (_, i) => focus + 1 + i);
  return {
    before,
    focus,
    after,
    afterStyle: before.length > 0 && after.length > 0 ? "trail" : "script",
    solo: null,
  };
}

/** @deprecated Use romanceLockup(texts) */
export function romanceLayout(tokenCount: number, _focus = 0) {
  const texts = Array.from({ length: Math.max(1, tokenCount) }, () => "word");
  const lock = romanceLockup(texts);
  return { before: lock.before, focus: lock.focus, after: lock.after };
}

export const ROMANCE_FOCUS_SCALE = 1.72;
export const ROMANCE_SCRIPT_SCALE = 0.42;
export const ROMANCE_TRAIL_SCALE = 0.22;
export const ROMANCE_SCRIPT_FONT = "Great Vibes";
/** Tracked trail letter-spacing (em). */
export const ROMANCE_TRAIL_TRACKING_EM = 0.52;

/** Conservative glyph width in em — prefer shrinking slightly over clipping. */
function estimateLineWidthPx(
  text: string,
  fontPx: number,
  trackingEm: number,
  glyphEm: number,
): number {
  if (!text || fontPx <= 0) return 0;
  const chars = [...text].length;
  return chars * fontPx * (glyphEm + Math.max(0, trackingEm)) + fontPx * 0.2;
}

/** Shrink a nowrap run (one word or one line) so it stays inside the video frame. */
export function captionFitScale(
  text: string,
  fontPx: number,
  maxWidthPx: number,
  glyphEm = 0.78,
): number {
  if (!text || fontPx <= 0 || maxWidthPx <= 0) return 1;
  const w = estimateLineWidthPx(text, fontPx, 0, glyphEm);
  if (w <= maxWidthPx) return 1;
  return Math.max(0.38, maxWidthPx / w);
}

/** Tightest fit across several runs — use the longest word at the largest size. */
export function captionFitScaleMany(
  texts: string[],
  fontPx: number,
  maxWidthPx: number,
  glyphEm = 0.78,
): number {
  let s = 1;
  for (const t of texts) {
    if (!t) continue;
    s = Math.min(s, captionFitScale(t, fontPx, maxWidthPx, glyphEm));
  }
  return s;
}

/**
 * Scale the whole Telugu Connects lockup so the longest line fits in the frame.
 * Used by live preview and ASS burn so long words like “yaalanuku” don’t clip.
 */
export function romanceFitScale(args: {
  hero: string;
  heroFontPx: number;
  heroTrackingEm: number;
  script: string;
  scriptFontPx: number;
  trail: string;
  trailFontPx: number;
  trailTrackingEm: number;
  maxWidthPx: number;
}): number {
  const max = args.maxWidthPx;
  if (max <= 0) return 1;
  const w = Math.max(
    estimateLineWidthPx(args.hero, args.heroFontPx, args.heroTrackingEm, 0.78),
    estimateLineWidthPx(args.script, args.scriptFontPx, 0.02, 0.5),
    estimateLineWidthPx(args.trail, args.trailFontPx, args.trailTrackingEm, 0.7),
  );
  if (w <= max) return 1;
  return Math.max(0.4, max / w);
}

/** Karaoke fill wins over Auto emphasis — same rule as the plain overlay. */
export function romanceTokenFill(
  index: number,
  text: string,
  filled: number,
  style: { karaoke?: boolean; emphasisMode?: "off" | "auto" | null },
): "accent" | "base" | "dim" {
  if (style.karaoke) return index < filled ? "accent" : "dim";
  if (isEmphasisOn(style) && isEmphasizedWord(text)) return "accent";
  return "base";
}

/** Vertical gap between stacked words, as % of video height (Style 1 / 3). */
export function kineticGapPct(fontSizePct: number): number {
  return Math.max(0.55, fontSizePct * 0.12);
}

/** Scatter stage height (% of video) — compact now that yPct offsets are tight. */
export function scatterStageHeightPct(fontSizePct: number): number {
  return Math.max(fontSizePct * 3.2, 18);
}

/**
 * Premium Style 3 (hook) layout slices — matches the boho/Klickpin "After" reference:
 * support words above, neon keyword (+ optional next word beside), rest below.
 */
export function hookLayout(tokenCount: number, focus = 0): {
  before: number[];
  focus: number;
  beside: number | null;
  below: number[];
} {
  const n = Math.max(1, tokenCount);
  const f = ((focus % n) + n) % n;
  const before = Array.from({ length: f }, (_, i) => i);
  const after = Array.from({ length: n - f - 1 }, (_, i) => f + 1 + i);
  const beside = after.length >= 1 ? after[0]! : null;
  const below = after.length > 1 ? after.slice(1) : [];
  return { before, focus: f, beside, below };
}

/** Focus scale vs satellite scale for hook mode. */
export const HOOK_FOCUS_SCALE = 1.35;
export const HOOK_SATELLITE_SCALE = 0.48;
/** Prefer a serif for white support lines when available. */
export const HOOK_SATELLITE_FONT = "Instrument Serif";
