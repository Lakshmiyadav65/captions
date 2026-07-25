// Curated self-hosted caption fonts (installed via @fontsource, imported in layout.tsx).
// The `family` value is used BOTH for the live CSS preview and as the font name written
// into exported ASS subtitles — keep them identical to the @font-face / TTF internal name.
// Matching TTFs in assets/fonts are required for burned-MP4 export (libass cannot read woff).

export type FontCategory = "sans" | "serif" | "display" | "handwriting";
export type FontScript = "latin" | "telugu";

export interface CaptionFont {
  id: string;
  label: string;
  family: string;
  category: FontCategory;
  script: FontScript;
  note?: string;
}

/** @deprecated Prefer CaptionFont — kept for vision matcher imports. */
export type TeluguFont = CaptionFont;

export const ENGLISH_FONTS: CaptionFont[] = [
  { id: "poppins", label: "Poppins", family: "Poppins", category: "sans", script: "latin", note: "Modern geometric — great for Tanglish" },
  { id: "montserrat", label: "Montserrat", family: "Montserrat", category: "sans", script: "latin", note: "Clean social / Reels look" },
  { id: "inter", label: "Inter", family: "Inter", category: "sans", script: "latin", note: "Neutral UI sans" },
  { id: "roboto", label: "Roboto", family: "Roboto", category: "sans", script: "latin", note: "Familiar YouTube-style sans" },
  { id: "open-sans", label: "Open Sans", family: "Open Sans", category: "sans", script: "latin", note: "Friendly readable sans" },
  { id: "oswald", label: "Oswald", family: "Oswald", category: "display", script: "latin", note: "Condensed impact" },
  { id: "bebas-neue", label: "Bebas Neue", family: "Bebas Neue", category: "display", script: "latin", note: "Tall all-caps display" },
  { id: "anton", label: "Anton", family: "Anton", category: "display", script: "latin", note: "Heavy poster weight" },
];

export const TELUGU_FONTS: CaptionFont[] = [
  { id: "noto", label: "Noto Sans Telugu", family: "Noto Sans Telugu", category: "sans", script: "telugu", note: "Clean & highly legible" },
  { id: "mandali", label: "Mandali", family: "Mandali", category: "sans", script: "telugu", note: "Friendly UI sans-serif" },
  { id: "mallanna", label: "Mallanna", family: "Mallanna", category: "sans", script: "telugu", note: "Soft, rounded" },
  { id: "ntr", label: "NTR", family: "NTR", category: "display", script: "telugu", note: "Bold, high-impact" },
  { id: "gidugu", label: "Gidugu", family: "Gidugu", category: "display", script: "telugu", note: "Casual & informal" },
  { id: "suranna", label: "Suranna", family: "Suranna", category: "serif", script: "telugu", note: "Elegant serif" },
  { id: "ramaraja", label: "Ramaraja", family: "Ramaraja", category: "serif", script: "telugu", note: "Traditional serif" },
  { id: "dhurjati", label: "Dhurjati", family: "Dhurjati", category: "handwriting", script: "telugu", note: "Handwritten feel" },
];

/** All selectable typefaces in the style panel (English first, then Telugu). */
export const CAPTION_FONTS: CaptionFont[] = [...ENGLISH_FONTS, ...TELUGU_FONTS];

export const DEFAULT_FONT_FAMILY = "Noto Sans Telugu";

/** CSS font-family stack; always falls back to a Telugu-capable font for mixed script. */
export function fontStack(family: string): string {
  return `'${family}', 'Noto Sans Telugu', 'Poppins', sans-serif`;
}
