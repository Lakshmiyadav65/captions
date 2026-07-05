import { DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles/style";

// Named starting points that show off the bundled fonts and common subtitle looks.
// Each is a full SubtitleStyle so selecting one resets every control predictably.

export interface StylePreset {
  id: string;
  name: string;
  style: SubtitleStyle;
}

export const PRESETS: StylePreset[] = [
  {
    id: "clean",
    name: "Clean",
    style: { ...DEFAULT_STYLE },
  },
  {
    id: "youtube",
    name: "YouTube",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Mandali",
      fontWeight: 700,
      outlineWidth: 0,
      shadow: false,
      backgroundColor: "#000000",
      backgroundOpacity: 0.75,
      bgPaddingXPct: 1.6,
      bgPaddingYPct: 0.7,
      positionYPct: 88,
    },
  },
  {
    id: "bold-outline",
    name: "Bold Outline",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "NTR",
      fontWeight: 700,
      fontSizePct: 6.5,
      color: "#FFFFFF",
      outlineColor: "#000000",
      outlineWidth: 5,
      shadow: true,
    },
  },
  {
    id: "yellow-pop",
    name: "Yellow Pop",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "NTR",
      fontWeight: 700,
      fontSizePct: 6,
      color: "#FFE100",
      outlineColor: "#000000",
      outlineWidth: 4,
    },
  },
  {
    id: "cinematic",
    name: "Cinematic",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Suranna",
      fontWeight: 400,
      fontSizePct: 5,
      color: "#F5E6C8",
      outlineColor: "#000000",
      outlineWidth: 2,
      shadow: true,
      positionYPct: 90,
      letterSpacingEm: 0.02,
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    style: {
      ...DEFAULT_STYLE,
      fontFamily: "Noto Sans Telugu",
      fontWeight: 400,
      fontSizePct: 4.5,
      outlineWidth: 0,
      shadow: true,
    },
  },
];
