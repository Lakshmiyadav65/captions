import { AnthropicVisionProvider } from "./anthropic";
import { MockVisionProvider } from "./mock";
import type { VisionProvider } from "./types";

export * from "./types";
export { profileToSubtitleStyle, clampConfidence } from "./convert";
export { profileSimilarity, bestMatch } from "./similarity";

// One shared selection of the vision backend by VISION_PROVIDER (auto|anthropic|mock). Falls
// back to the keyless mock when no ANTHROPIC_API_KEY is present (mirrors the ASR registry).

export function getVisionProvider(): VisionProvider {
  const choice = (process.env.VISION_PROVIDER || "auto").toLowerCase();
  if (choice === "mock") return new MockVisionProvider();
  if (choice === "anthropic") return new AnthropicVisionProvider();
  // auto
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicVisionProvider();
  return new MockVisionProvider();
}

/** True when a real vision API ran (vs. the built-in sample profile). */
export const isLiveVision = (p: VisionProvider) => p.name !== "mock";
