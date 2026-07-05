// Curated set of self-hosted Telugu fonts (installed via @fontsource, imported in
// layout.tsx). The `family` value is used BOTH for the live CSS preview and as the
// font name written into exported ASS subtitles — keep them identical to the @font-face.

export type FontCategory = "sans" | "serif" | "display" | "handwriting";

export interface TeluguFont {
  id: string;
  label: string;
  family: string;
  category: FontCategory;
  note?: string;
}

export const TELUGU_FONTS: TeluguFont[] = [
  { id: "noto", label: "Noto Sans Telugu", family: "Noto Sans Telugu", category: "sans", note: "Clean & highly legible — default" },
  { id: "mandali", label: "Mandali", family: "Mandali", category: "sans", note: "Friendly UI sans-serif" },
  { id: "mallanna", label: "Mallanna", family: "Mallanna", category: "sans", note: "Soft, rounded" },
  { id: "ntr", label: "NTR", family: "NTR", category: "display", note: "Bold, high-impact" },
  { id: "gidugu", label: "Gidugu", family: "Gidugu", category: "display", note: "Casual & informal" },
  { id: "suranna", label: "Suranna", family: "Suranna", category: "serif", note: "Elegant serif" },
  { id: "ramaraja", label: "Ramaraja", family: "Ramaraja", category: "serif", note: "Traditional serif" },
  { id: "dhurjati", label: "Dhurjati", family: "Dhurjati", category: "handwriting", note: "Handwritten feel" },
];

export const DEFAULT_FONT_FAMILY = "Noto Sans Telugu";

/** CSS font-family stack that always falls back to a Telugu-capable font. */
export function fontStack(family: string): string {
  return `'${family}', 'Noto Sans Telugu', sans-serif`;
}
