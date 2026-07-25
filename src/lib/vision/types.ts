import type { FontCategory } from "@/lib/fonts";
import type { SubtitleStyle } from "@/lib/subtitles/style";

// Shared, normalized model for the Caption Style Analyzer. A vision provider extracts a
// StyleProfile (relative buckets + hex + a font descriptor + confidence) — never pixel
// measurements and never the source caption text. `profileToSubtitleStyle` (convert.ts)
// maps it onto the existing SubtitleStyle so it drives the SAME preview + ASS + burned MP4.

export type { FontCategory };

export type BundledFontId =
  | "noto"
  | "mandali"
  | "mallanna"
  | "ntr"
  | "gidugu"
  | "suranna"
  | "ramaraja"
  | "dhurjati";

export interface StyleProfile {
  /** Which provider produced this (anthropic | mock). Added server-side, not by the model. */
  provider: string;
  font: {
    category: FontCategory;
    weight: "thin" | "regular" | "medium" | "bold" | "black";
    /** Descriptive traits (e.g. ["rounded","heavy"]) that drive the font matcher. */
    traits: string[];
    /** Advisory tiebreak only — the model can't have seen our bundled fonts. */
    closestBundledFont: BundledFontId;
  };
  /** Resolved to one of the 8 bundled Telugu fonts by fontMatch.ts (added server-side). */
  fontMatch: { fontId: BundledFontId; category: FontCategory; confidence: number };
  typography: {
    sizeBucket: "s" | "m" | "l" | "xl";
    letterSpacing: "tight" | "normal" | "wide";
    lineSpacing: "tight" | "normal" | "loose";
    uppercase: boolean;
  };
  colors: {
    text: string; // "#RRGGBB"
    outline: string | null;
    background: string | null;
    highlight: string | null;
    backgroundOpacity: "none" | "semi" | "solid";
  };
  outline: { present: boolean; weight: "thin" | "medium" | "thick" };
  layout: {
    align: "left" | "center" | "right";
    positionBucket: "top" | "middle" | "lower" | "bottom";
    maxWidthBucket: "narrow" | "medium" | "wide";
  };
  effects: { shadow: boolean; karaoke: boolean };
  /** Short freeform label; DISPLAY-ONLY (never fed verbatim to caption generation). */
  vibe: string;
  confidence: number; // 0..1
}

/** The model returns everything except `provider` + `fontMatch` (both added server-side). */
export type StyleProfileModelOutput = Omit<StyleProfile, "provider" | "fontMatch">;

export interface StyleProfileInput {
  imagePath: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  signal?: AbortSignal;
}

export interface OcrResult {
  provider: string;
  text: string;
}

/** A pluggable vision backend. Add a vendor by implementing this + registering in index.ts. */
export interface VisionProvider {
  readonly name: string;
  /** Extract the design language of the captions. Returns a profile WITH fontMatch attached. */
  analyzeStyle(input: StyleProfileInput): Promise<StyleProfile>;
  /** Optional, separate concern: read the caption text (off by default; never fed to gen). */
  ocr?(input: StyleProfileInput): Promise<OcrResult>;
}

// --- Client/server-shared DTOs ---

export interface StyleMatch {
  savedStyleId: string;
  name: string;
  similarity: number; // 0..1
}

export interface AnalyzeResponse {
  analysisId: string;
  sourceImageKey: string;
  imageUrl: string;
  profile: StyleProfile;
  subtitleStyle: SubtitleStyle;
  ocrText: string | null;
  match: StyleMatch | null;
}

export interface SavedStyleDTO {
  id: string;
  name: string;
  confidence: number;
  createdAt: string;
  profile: StyleProfile;
  subtitleStyle: SubtitleStyle;
  imageUrl: string | null;
}
