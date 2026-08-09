import { MockProvider } from "./mock";
import { OpenAIProvider } from "./openai";
import { SarvamProvider } from "./sarvam";
import type { TranscriptionProvider } from "./types";

export * from "./types";
export { alignWordTimings } from "./align-timings";
export { flattenWords } from "./openai";
export { CAPTION_SYNC_DELAY_SEC, withCaptionSyncDelay } from "./sync-delay";

// Picks the transcription backend from env. Set ASR_PROVIDER=sarvam|openai|mock, or leave
// it unset/"auto" to use whichever API key is present (preferring Sarvam for Telugu).
// Falls back to the keyless MockProvider so the app always runs out of the box.
export function getProvider(): TranscriptionProvider {
  const choice = (process.env.ASR_PROVIDER || "auto").toLowerCase();

  if (choice === "mock") return new MockProvider();
  if (choice === "sarvam") return new SarvamProvider();
  if (choice === "openai") return new OpenAIProvider();

  // auto
  if (process.env.SARVAM_API_KEY) return new SarvamProvider();
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
  return new MockProvider();
}

/** True when we'll really call an ASR API (vs. returning the sample transcript). */
export function isLiveProvider(p: TranscriptionProvider): boolean {
  return p.name !== "mock";
}
