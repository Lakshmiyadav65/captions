import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import { CAPTION_SYSTEM, CAPTION_SCHEMA, buildUserPrompt } from "./prompt";
import type { CaptionProvider, CaptionResult, GenerateOptions } from "./types";

// Live caption generation via Anthropic Claude (default claude-haiku-4-5 — cheap). Forced
// JSON-schema output so we get just the caption, no preamble. Thinking is left at the model
// default (omitted) to keep this fast and cheap.

export class ClaudeCaptionProvider implements CaptionProvider {
  readonly name = "claude";

  async generate(opts: GenerateOptions): Promise<CaptionResult> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    const client = new Anthropic();

    const res = await client.messages.create(
      {
        model: config.generateModel,
        max_tokens: 256,
        output_config: {
          format: { type: "json_schema", schema: CAPTION_SCHEMA as Record<string, unknown> },
        },
        system: CAPTION_SYSTEM,
        messages: [{ role: "user", content: buildUserPrompt(opts) }],
      },
      { signal: opts.signal },
    );

    if (res.stop_reason === "refusal") {
      throw new Error("REFUSAL: the model declined to generate a caption for this prompt.");
    }
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("No caption was returned.");

    let text: string;
    try {
      text = (JSON.parse(block.text) as { caption: string }).caption.trim();
    } catch {
      throw new Error("The model returned an unparseable caption.");
    }
    if (!text) throw new Error("The model returned an empty caption.");
    return { provider: this.name, text };
  }
}
