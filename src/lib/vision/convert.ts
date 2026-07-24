import { DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles/style";
import { TELUGU_FONTS, DEFAULT_FONT_FAMILY } from "@/lib/fonts";
import { config } from "@/lib/config";
import { normalizeHex } from "./color";
import type { StyleProfile } from "./types";

// The single integration seam: turn a normalized StyleProfile into a COMPLETE SubtitleStyle
// (every field set, spread over DEFAULT_STYLE) so the extracted look flows through the same
// live overlay + toASS + burned-MP4 pipeline with zero new render code. Bucket->number
// tables live here so the analyzer never has to guess pixel values.

const SIZE_PCT = { s: 4.5, m: 5.5, l: 6.5, xl: 8 } as const;
const TRACKING_EM = { tight: -0.02, normal: 0, wide: 0.06 } as const;
const LINE_MULT = { tight: 1.1, normal: 1.25, loose: 1.5 } as const;
const OPACITY = { none: 0, semi: 0.7, solid: 0.9 } as const;
const VPOS_PCT = { top: 12, middle: 50, lower: 82, bottom: 90 } as const;
const WIDTH_PCT = { narrow: 70, medium: 85, wide: 95 } as const;
const OUTLINE_W = { thin: 2, medium: 3.5, thick: 5 } as const;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
export const clampConfidence = (n: number) => (Number.isFinite(n) ? clamp(n, 0, 1) : 0);
const hex = (v: string | null | undefined, fallback: string) => normalizeHex(v) ?? fallback;

function familyOf(fontId: string): string {
  return TELUGU_FONTS.find((f) => f.id === fontId)?.family ?? DEFAULT_FONT_FAMILY;
}

function cssWeight(w: StyleProfile["font"]["weight"]): number {
  return w === "bold" || w === "black" ? 700 : w === "medium" ? 500 : 400;
}

export function profileToSubtitleStyle(p: StyleProfile): SubtitleStyle {
  const { typography: t, colors: c, layout: l, effects: e, outline: o } = p;

  const hasBox = c.backgroundOpacity !== "none"; // box vs outline: decide the master switch first
  const hasOutline = !hasBox && (o.present || c.outline != null);
  // Letter-spacing corrupts Telugu conjunct shaping, so only honor it for romanized output.
  const translit = config.outputMode === "translit";

  return {
    ...DEFAULT_STYLE,
    fontFamily: familyOf(p.fontMatch.fontId),
    fontSizePct: clamp(SIZE_PCT[t.sizeBucket], 2, 12),
    fontWeight: cssWeight(p.font.weight),
    color: hex(c.text, DEFAULT_STYLE.color),
    outlineColor: hex(c.outline, DEFAULT_STYLE.outlineColor),
    outlineWidth: hasOutline ? clamp(OUTLINE_W[o.weight], 0, 10) : 0,
    shadow: e.shadow,
    backgroundColor: hex(c.background, DEFAULT_STYLE.backgroundColor),
    backgroundOpacity: hasBox ? OPACITY[c.backgroundOpacity] : 0,
    bgPaddingXPct:
      hasBox && c.backgroundOpacity === "solid" ? 1.6 : DEFAULT_STYLE.bgPaddingXPct,
    bgPaddingYPct:
      hasBox && c.backgroundOpacity === "solid" ? 0.7 : DEFAULT_STYLE.bgPaddingYPct,
    align: l.align,
    positionYPct: clamp(VPOS_PCT[l.positionBucket], 5, 95),
    lineHeight: clamp(LINE_MULT[t.lineSpacing], 0.9, 2),
    maxWidthPct: clamp(WIDTH_PCT[l.maxWidthBucket], 40, 100),
    letterSpacingEm: translit ? clamp(TRACKING_EM[t.letterSpacing], -0.05, 0.3) : 0,
    uppercase: t.uppercase,
    // Karaoke needs a highlight color to mean anything; a two-tone look alone can't flip it.
    karaoke: e.karaoke && c.highlight != null,
    highlightColor: hex(c.highlight, DEFAULT_STYLE.highlightColor),
    glowStrength: 0,
    glowColor: hex(c.text, DEFAULT_STYLE.glowColor),
    boxMode: hasBox ? "inline" : "none",
    boxRadiusPct: DEFAULT_STYLE.boxRadiusPct,
    animation: "none",
  };
}
