// The single source of truth for how a subtitle looks. Used by the live in-browser
// overlay (StylePanel/SubtitleOverlay) AND by the SRT/VTT/ASS exporters, so what you
// see in the preview is what you get in the exported file.

export type TextAlign = "left" | "center" | "right";

/** Background treatment behind the caption text. */
export type BoxMode = "none" | "inline" | "pill" | "bar";

/** Short entrance motion when a new caption line appears. */
export type CaptionAnimation =
  | "none"
  | "fade"
  | "pop"
  | "kinetic"
  | "scatter"
  | "hook"
  | "flash"
  | "editorial"
  | "atelier"
  | "typewriter";

/** Special glyph treatments beyond flat fill (preview-rich; ASS approximates). */
export type TextEffect = "none" | "prism" | "negative" | "ember";

/** Static keyword coloring (neon accents) independent of karaoke fill. */
export type EmphasisMode = "off" | "auto";

/** How caption text is cased for preview + burned export. */
export type TextCase = "none" | "sentence" | "title" | "lower" | "upper";

export interface SubtitleStyle {
  /** CSS font-family value; must match one of the bundled Telugu fonts (see fonts.ts). */
  fontFamily: string;
  /**
   * Caption size on a 1–10 scale (internally % of video height, so it scales to any
   * resolution). Max is 10; ~3–4 usually looks best.
   */
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
  /**
   * Display casing. Prefer `textCase`; legacy `uppercase: true` still means "upper".
   */
  textCase: TextCase;
  /** @deprecated Prefer `textCase`. Kept so older saved styles / presets still load. */
  uppercase?: boolean;
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
   * Glyph treatment.
   * - `prism` ≈ frosted glass + iridescent shimmer
   * - `negative` ≈ difference-blend white (Clipvo “Negative”)
   * - `ember` ≈ orange→red fire gradient (Clipvo “Ember”)
   */
  textEffect: TextEffect;
  /**
   * Auto-color keywords with `highlightColor` (Tharun Speaks yellow/white look).
   * Independent of karaoke progressive fill.
   */
  emphasisMode: EmphasisMode;
}

/** Resolve casing mode, including legacy `uppercase` boolean. */
export function effectiveTextCase(style: Pick<SubtitleStyle, "textCase" | "uppercase">): TextCase {
  if (style.textCase) return style.textCase;
  return style.uppercase ? "upper" : "none";
}

/** Apply a casing mode to caption text (preview + ASS share this). */
export function applyTextCase(text: string, mode: TextCase): string {
  if (!text) return text;
  switch (mode) {
    case "upper":
      return text.toUpperCase();
    case "lower":
      return text.toLowerCase();
    case "sentence": {
      // First letter of the string (and of each new line) capital; everything else lower.
      const lower = text.toLowerCase();
      return lower.replace(/(^|[.!?]\s+|\n\s*)(\S)/g, (_, lead: string, ch: string) => lead + ch.toUpperCase());
    }
    case "title":
      return text
        .toLowerCase()
        .replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, lead: string, ch: string) => lead + ch.toUpperCase());
    default:
      return text;
  }
}

/**
 * Default look — Caplio Styles 2.0 "Classic":
 * bold white kinetic captions mid-frame, neon-yellow emphasis, soft bloom
 * (no hard outline), pop-in. Same as the Classic preset.
 */
export const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: "NTR",
  fontSizePct: 4,
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
  positionYPct: 55,
  lineHeight: 1.05,
  maxWidthPct: 82,
  letterSpacingEm: -0.03,
  textCase: "none",
  karaoke: false,
  highlightColor: "#E2FF00",
  glowStrength: 1,
  glowColor: "#FFFFFF",
  boxMode: "none",
  boxRadiusPct: 1.2,
  animation: "pop",
  textEffect: "none",
  emphasisMode: "auto",
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
