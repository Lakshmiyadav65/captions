// The single source of truth for how a subtitle looks. Used by the live in-browser
// overlay (StylePanel/SubtitleOverlay) AND by the SRT/VTT/ASS exporters, so what you
// see in the preview is what you get in the exported file.

export type TextAlign = "left" | "center" | "right";

/** Background treatment behind the caption text. */
export type BoxMode = "none" | "inline" | "pill" | "bar";

/** Short entrance motion when a new caption line appears. */
export type CaptionAnimation = "none" | "fade" | "pop";

/** Special glyph treatments beyond flat fill (preview-rich; ASS approximates). */
export type TextEffect = "none" | "prism";

export interface SubtitleStyle {
  /** CSS font-family value; must match one of the bundled Telugu fonts (see fonts.ts). */
  fontFamily: string;
  /** Font size as a percentage of the VIDEO HEIGHT, so it scales to any resolution. */
  fontSizePct: number;
  fontWeight: number;
  /** Fill color, hex e.g. "#FFFFFF". */
  color: string;
  /** Outline (stroke) color + width. Width is in px at a 1080p reference height. */
  outlineColor: string;
  outlineWidth: number;
  /** Soft drop shadow behind the glyphs for readability on busy footage. */
  shadow: boolean;
  /** Background "box" behind the text. */
  backgroundColor: string;
  backgroundOpacity: number; // 0..1
  bgPaddingXPct: number; // horizontal padding, % of video height
  bgPaddingYPct: number; // vertical padding, % of video height
  align: TextAlign;
  /** Vertical anchor of the subtitle block, % from the top of the video (0=top,100=bottom). */
  positionYPct: number;
  lineHeight: number; // multiplier
  /** Max width of the text block as a % of video width (wraps long lines). */
  maxWidthPct: number;
  letterSpacingEm: number;
  uppercase: boolean;
  /** Word-by-word "karaoke" highlight: spoken words switch to `highlightColor` and stay filled. */
  karaoke: boolean;
  /** Fill color for words that have been spoken (used when `karaoke` is on). */
  highlightColor: string;
  /** Outer neon/soft glow strength (0 = off). Layered text-shadow in preview; ASS approximates via outline. */
  glowStrength: number;
  /** Glow color, hex. */
  glowColor: string;
  /**
   * Background shape: none / per-line box / rounded pill / full-width bar (lower-third).
   * Legacy styles with backgroundOpacity > 0 and no boxMode are treated as "inline".
   */
  boxMode: BoxMode;
  /** Pill corner radius as % of video height (preview; ASS boxes stay rectangular). */
  boxRadiusPct: number;
  /** Entrance animation when a new line appears. */
  animation: CaptionAnimation;
  /**
   * Glyph treatment. `prism` ≈ Captions.ai "Prism Pro": frosted glass fill with an
   * iridescent shimmer (preview). Burned ASS uses a soft translucent white approx.
   */
  textEffect: TextEffect;
}

/**
 * Default look — matched from Video-24275.mp4: bold white kinetic captions,
 * mid-frame, soft bloom (no hard outline), pop-in. Same as the "Center Pop" preset.
 */
export const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: "NTR",
  fontSizePct: 7.2,
  fontWeight: 700,
  color: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 0,
  shadow: true,
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  bgPaddingXPct: 1.2,
  bgPaddingYPct: 0.6,
  align: "center",
  positionYPct: 52,
  lineHeight: 1.05,
  maxWidthPct: 82,
  letterSpacingEm: -0.02,
  uppercase: false,
  karaoke: false,
  highlightColor: "#FFE100",
  glowStrength: 0,
  glowColor: "#FFFFFF",
  boxMode: "none",
  boxRadiusPct: 1.2,
  animation: "pop",
  textEffect: "none",
};

/**
 * Resolve effective box mode for rendering. Old saved styles may omit `boxMode` but
 * still have backgroundOpacity > 0 — treat those as inline boxes.
 */
export function effectiveBoxMode(style: SubtitleStyle): BoxMode {
  const mode = style.boxMode ?? "none";
  if (mode === "none" && (style.backgroundOpacity ?? 0) > 0) return "inline";
  return mode;
}

/** Whether the style should draw a filled background (inline/pill/bar). */
export function hasBackgroundBox(style: SubtitleStyle): boolean {
  const mode = effectiveBoxMode(style);
  return mode !== "none" && (style.backgroundOpacity ?? 0) > 0;
}
