import { computeFontMatch } from "./fontMatch";
import type {
  StyleProfile,
  StyleProfileInput,
  StyleProfileModelOutput,
  VisionProvider,
} from "./types";

// Keyless fallback used when no ANTHROPIC_API_KEY is configured — returns a fixed, plausible
// StyleProfile so the whole upload -> analyze -> convert -> preview -> save flow works out of
// the box before any vision key is set (mirrors the transcription MockProvider).

const SAMPLE: StyleProfileModelOutput = {
  font: {
    category: "display",
    weight: "bold",
    traits: ["bold", "heavy", "impact"],
    closestBundledFont: "ntr",
  },
  typography: {
    sizeBucket: "l",
    letterSpacing: "normal",
    lineSpacing: "normal",
    uppercase: false,
  },
  colors: {
    text: "#FFFFFF",
    outline: "#000000",
    background: null,
    highlight: "#FFE100",
    backgroundOpacity: "none",
  },
  outline: { present: true, weight: "medium" },
  layout: { align: "center", positionBucket: "lower", maxWidthBucket: "wide" },
  effects: { shadow: true, karaoke: false },
  vibe: "Bold white captions with a black outline",
  confidence: 0.6,
};

export class MockVisionProvider implements VisionProvider {
  readonly name = "mock";

  async analyzeStyle(_input: StyleProfileInput): Promise<StyleProfile> {
    // Small delay so the UI's "analyzing…" state is visible.
    await new Promise((r) => setTimeout(r, 500));
    return {
      ...SAMPLE,
      provider: this.name,
      fontMatch: computeFontMatch(SAMPLE.font),
    };
  }
}
