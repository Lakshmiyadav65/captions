import { DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles/style";

// Caplio Styles 2.0 — curated catalog (Hypro-like viral looks + Caplio-unique Negative).
// Landing demos and the editor StylePanel both consume this list.

export type PresetCategory =
  | "aesthetic"
  | "impact"
  | "sync"
  | "quiet"
  | "premium";

export interface StylePreset {
  id: string;
  name: string;
  category: PresetCategory;
  /** Short chip shown on the card (Aesthetic, Karaoke, …). */
  tag?: string;
  /** Short sample shown on the picker card. */
  sample?: string;
  /**
   * Landing CSS animation key (maps to `.lp-anim-*`). Optional — editor cards
   * ignore this and render from `style`.
   */
  landingAnim?: string;
  /** Styles generation — 2.0 curated viral set, 3.0 premium atelier looks. */
  generation?: "2.0" | "3.0";
  /** Default words-per-frame when this preset is applied (Styles 3.0). */
  wordsPerFrame?: number;
  style: SubtitleStyle;
}

export const PRESET_CATEGORIES: { id: PresetCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "aesthetic", label: "Aesthetic" },
  { id: "impact", label: "Impact" },
  { id: "sync", label: "Sync" },
  { id: "quiet", label: "Quiet" },
  { id: "premium", label: "Premium" },
];

const ACCENT_RED = "#FF3B30";

/** Styles 2.0 — curated presets. */
export const PRESETS: StylePreset[] = [
  {
    id: "classic",
    name: "Classic",
    category: "aesthetic",
    tag: "Default",
    sample: "GUARANTEES",
    landingAnim: "classic",
    style: { ...DEFAULT_STYLE },
  },
  {
    id: "bold",
    name: "Bold",
    category: "impact",
    tag: "Impact",
    sample: "WATCH THIS",
    landingAnim: "bold",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Anton",
      fontWeight: 400,
      fontSizePct: 6.5,
      color: "#FFFFFF",
      outlineColor: "#000000",
      outlineWidth: 4,
      shadow: true,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 78,
      maxWidthPct: 90,
      letterSpacingEm: 0.02,
      lineHeight: 1,
      textCase: "upper",
      uppercase: true,
      karaoke: false,
      emphasisMode: "off",
      animation: "pop",
      textEffect: "none",
      highlightColor: "#FFFFFF",
    },
  },
  {
    id: "highlight",
    name: "Highlight",
    category: "aesthetic",
    tag: "Aesthetic",
    sample: "this",
    landingAnim: "highlight",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Inter",
      fontWeight: 700,
      fontSizePct: 3.6,
      color: "#111111",
      highlightColor: "#111111",
      outlineWidth: 0,
      shadow: false,
      glowStrength: 0,
      backgroundColor: "#FFE600",
      backgroundOpacity: 1,
      bgPaddingXPct: 1.8,
      bgPaddingYPct: 0.7,
      boxMode: "inline",
      boxRadiusPct: 0.15,
      positionYPct: 54,
      maxWidthPct: 86,
      letterSpacingEm: -0.01,
      lineHeight: 1.1,
      textCase: "lower",
      uppercase: false,
      karaoke: false,
      emphasisMode: "off",
      animation: "fade",
      textEffect: "none",
    },
  },
  {
    id: "karaoke",
    name: "Karaoke",
    category: "sync",
    tag: "Sync",
    sample: "viral",
    landingAnim: "karaoke",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Montserrat",
      fontWeight: 700,
      fontSizePct: 4.6,
      color: "#FFFFFF",
      highlightColor: ACCENT_RED,
      outlineWidth: 0,
      shadow: true,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 56,
      maxWidthPct: 90,
      letterSpacingEm: -0.02,
      lineHeight: 1.15,
      textCase: "lower",
      uppercase: false,
      karaoke: true,
      emphasisMode: "off",
      animation: "fade",
      textEffect: "none",
    },
  },
  {
    id: "soft-focus",
    name: "Soft Focus",
    category: "quiet",
    tag: "Soft focus",
    sample: "this is",
    landingAnim: "blur",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Inter",
      fontWeight: 400,
      fontSizePct: 2.8,
      color: "#FFFFFF",
      highlightColor: "#FFFFFF",
      outlineWidth: 0,
      shadow: true,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 28,
      maxWidthPct: 70,
      letterSpacingEm: 0.02,
      lineHeight: 1.2,
      textCase: "lower",
      uppercase: false,
      karaoke: false,
      emphasisMode: "off",
      animation: "fade",
      textEffect: "none",
    },
  },
  {
    id: "negative",
    name: "Negative",
    category: "aesthetic",
    tag: "Aesthetic",
    sample: "THIS",
    landingAnim: "bold",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Anton",
      fontWeight: 400,
      fontSizePct: 7.2,
      color: "#FFFFFF",
      highlightColor: "#FFFFFF",
      outlineWidth: 0,
      shadow: false,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 48,
      maxWidthPct: 90,
      letterSpacingEm: -0.02,
      lineHeight: 1,
      textCase: "upper",
      uppercase: true,
      karaoke: false,
      emphasisMode: "off",
      animation: "pop",
      textEffect: "negative",
    },
  },
];

/** Styles 3.0 — premium looks. */
export const PRESETS_V3: StylePreset[] = [
  {
    id: "raj-shamani",
    name: "Raj Shamani",
    category: "premium",
    tag: "Premium 3.0",
    sample: "MEERU EE REEL NI",
    generation: "3.0",
    // 8 words → 4 caps (required) + 4 lower. Stay inside 80% focus band.
    wordsPerFrame: 8,
    landingAnim: "bold",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Anton",
      fontWeight: 400,
      fontSizePct: 7.8,
      color: "#FFFFFF",
      highlightColor: "#FFD400",
      outlineWidth: 0,
      shadow: true,
      glowStrength: 0,
      glowColor: "#FFD400",
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 68,
      maxWidthPct: 80,
      letterSpacingEm: 0.02,
      lineHeight: 1,
      textCase: "none",
      uppercase: false,
      karaoke: true,
      emphasisMode: "off",
      animation: "shamani",
      textEffect: "none",
    },
  },
  {
    id: "pinterest-2",
    name: "Pinterest 2",
    category: "premium",
    tag: "Premium 3.0",
    sample: "the math",
    generation: "3.0",
    wordsPerFrame: 5,
    landingAnim: "classic",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Instrument Serif",
      fontWeight: 400,
      fontSizePct: 8.6,
      color: "#FFFFFF",
      highlightColor: "#C8FF00",
      outlineWidth: 0,
      shadow: false,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 48,
      maxWidthPct: 86,
      letterSpacingEm: -0.02,
      lineHeight: 0.9,
      textCase: "lower",
      uppercase: false,
      karaoke: true,
      emphasisMode: "off",
      animation: "pinterest",
      textEffect: "none",
    },
  },
  {
    id: "pinterest-3",
    name: "Pinterest 3",
    category: "premium",
    tag: "Premium 3.0",
    sample: "tell me",
    generation: "3.0",
    wordsPerFrame: 4,
    landingAnim: "bold",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Inter",
      fontWeight: 800,
      fontSizePct: 8.2,
      color: "#FFFFFF",
      highlightColor: "#FFFFFF",
      outlineWidth: 0,
      shadow: false,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 50,
      maxWidthPct: 88,
      letterSpacingEm: -0.05,
      lineHeight: 0.85,
      textCase: "none",
      uppercase: false,
      karaoke: false,
      emphasisMode: "off",
      animation: "pinterest3",
      textEffect: "none",
    },
  },
  {
    id: "pinterest-4",
    name: "Pinterest 4",
    category: "premium",
    tag: "Premium 3.0",
    sample: "performing",
    generation: "3.0",
    wordsPerFrame: 6,
    landingAnim: "classic",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Inter",
      fontWeight: 800,
      fontSizePct: 7.8,
      color: "#FFFFFF",
      highlightColor: "#FFFFFF",
      outlineWidth: 0,
      shadow: false,
      glowStrength: 0,
      backgroundOpacity: 0,
      boxMode: "none",
      positionYPct: 48,
      maxWidthPct: 86,
      letterSpacingEm: -0.04,
      lineHeight: 0.88,
      textCase: "none",
      uppercase: false,
      karaoke: true,
      emphasisMode: "off",
      animation: "pinterest4",
      textEffect: "none",
    },
  },
];

/** Full catalog — Styles 2.0 + Styles 3.0. */
export const ALL_PRESETS: StylePreset[] = [...PRESETS_V3, ...PRESETS];

/** Find the preset whose style matches `style` field-for-field (used to highlight the card). */
export function matchingPresetId(style: SubtitleStyle): string | null {
  for (const p of ALL_PRESETS) {
    if (stylesEqual(p.style, style)) return p.id;
  }
  return null;
}

export function getPresetById(id: string): StylePreset | undefined {
  return ALL_PRESETS.find((p) => p.id === id);
}

function stylesEqual(a: SubtitleStyle, b: SubtitleStyle): boolean {
  const keys = Object.keys(DEFAULT_STYLE) as (keyof SubtitleStyle)[];
  return keys.every((k) => a[k] === b[k]);
}
