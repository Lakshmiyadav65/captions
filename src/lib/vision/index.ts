import { MockVisionProvider } from "./mock";
import type { VisionProvider } from "./types";

export * from "./types";
export { profileToSubtitleStyle, clampConfidence } from "./convert";
export { profileSimilarity, bestMatch } from "./similarity";

// One shared selection of the vision backend by VISION_PROVIDER (auto|anthropic|mock).
// The live Anthropic provider is wired in a later step; until then the keyless mock keeps
// the entire flow working with no ANTHROPIC_API_KEY (mirrors the transcription registry).

export function getVisionProvider(): VisionProvider {
  const choice = (process.env.VISION_PROVIDER || "auto").toLowerCase();
  if (choice === "anthropic") {
    console.warn(
      "VISION_PROVIDER=anthropic but the live vision provider is not wired yet — using mock.",
    );
  }
  return new MockVisionProvider();
}

/** True when a real vision API ran (vs. the built-in sample profile). */
export const isLiveVision = (p: VisionProvider) => p.name !== "mock";
