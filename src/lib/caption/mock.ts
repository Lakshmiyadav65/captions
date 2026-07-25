import type { CaptionProvider, CaptionResult, GenerateOptions } from "./types";

// Keyless fallback: returns a fixed original Telugu caption so the generate flow works with
// no ANTHROPIC_API_KEY (mirrors the ASR / vision mocks).

const SAMPLES = [
  "మీ కల వైపు మొదటి అడుగు వేయండి",
  "ఈ రోజు నుండే మొదలుపెట్టండి",
  "ప్రతి రోజు కొంచెం మెరుగవ్వండి",
  "నమ్మకమే మీ బలం",
];

export class MockCaptionProvider implements CaptionProvider {
  readonly name = "mock";

  async generate(opts: GenerateOptions): Promise<CaptionResult> {
    await new Promise((r) => setTimeout(r, 400));
    // Deterministic pick from the prompt so repeated prompts are stable.
    const i = Math.abs(hash(opts.prompt)) % SAMPLES.length;
    return { provider: this.name, text: SAMPLES[i] };
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}
