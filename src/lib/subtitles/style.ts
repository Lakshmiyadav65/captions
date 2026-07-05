// The single source of truth for how a subtitle looks. Used by the live in-browser
// overlay (StylePanel/SubtitleOverlay) AND by the SRT/VTT/ASS exporters, so what you
// see in the preview is what you get in the exported file.

export type TextAlign = "left" | "center" | "right";

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
}

/** A sane default so the overlay always has something to render. */
export const DEFAULT_STYLE: SubtitleStyle = {
  fontFamily: "Noto Sans Telugu",
  fontSizePct: 5.5,
  fontWeight: 700,
  color: "#FFFFFF",
  outlineColor: "#000000",
  outlineWidth: 3,
  shadow: true,
  backgroundColor: "#000000",
  backgroundOpacity: 0,
  bgPaddingXPct: 1.2,
  bgPaddingYPct: 0.6,
  align: "center",
  positionYPct: 86,
  lineHeight: 1.25,
  maxWidthPct: 90,
  letterSpacingEm: 0,
  uppercase: false,
};
