import { ClaudeCaptionProvider } from "./claude";
import { MockCaptionProvider } from "./mock";
import type { CaptionProvider } from "./types";

export * from "./types";

// Selects the caption backend by CAPTION_PROVIDER (auto|claude|mock). Falls back to the
// keyless mock when no ANTHROPIC_API_KEY is present (mirrors the ASR / vision registries).

export function getCaptionProvider(): CaptionProvider {
  const choice = (process.env.CAPTION_PROVIDER || "auto").toLowerCase();
  if (choice === "mock") return new MockCaptionProvider();
  if (choice === "claude") return new ClaudeCaptionProvider();
  // auto
  if (process.env.ANTHROPIC_API_KEY) return new ClaudeCaptionProvider();
  return new MockCaptionProvider();
}
