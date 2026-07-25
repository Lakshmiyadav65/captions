import type { GenerateOptions } from "./types";

// Generation is constrained to ONE short, original Telugu caption. The style vibe is passed
// as tone-only, untrusted context (truncated) — never as text to echo — so an analyzed
// screenshot's wording can never leak into a generated caption.

export const CAPTION_SYSTEM = `You write short, punchy, ORIGINAL Telugu captions for Instagram Reels and YouTube Shorts. Given a topic or instruction, return ONE caption in natural Telugu script (native lipi), roughly 3-10 words. No hashtags, no emojis unless explicitly requested, no surrounding quotes, no preamble. Match the requested tone/vibe. NEVER copy or paraphrase any existing caption or on-screen text — always write something new. Your entire response MUST conform to the provided JSON schema.`;

export const CAPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["caption"],
  properties: { caption: { type: "string" } },
} as const;

export function buildUserPrompt(opts: GenerateOptions): string {
  const vibe = (opts.vibe ?? "").slice(0, 120).trim();
  const lines = [
    "Write one short, original Telugu caption in Telugu script.",
    `Request: ${opts.prompt.slice(0, 400).trim()}`,
  ];
  if (vibe) {
    lines.push(
      `Match this visual tone (for feel only — do NOT quote or reuse these words): "${vibe}"`,
    );
  }
  return lines.join("\n");
}
