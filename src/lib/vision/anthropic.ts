import { readFile } from "node:fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import { config } from "@/lib/config";
import { STYLE_PROFILE_SCHEMA } from "./schema";
import { SYSTEM_PROMPT, USER_PROMPT, OCR_SYSTEM } from "./prompt";
import { computeFontMatch } from "./fontMatch";
import { ffmpegDownscale } from "./downscale";
import type {
  OcrResult,
  StyleProfile,
  StyleProfileInput,
  StyleProfileModelOutput,
  VisionProvider,
} from "./types";

// Live vision provider: Anthropic Claude (default claude-sonnet-5) reads the screenshot and
// returns a StyleProfile via forced JSON-schema structured output. Thinking is disabled — the
// task is bucketed enum + hex extraction, and disabling keeps latency/cost down and the token
// budget clean for the JSON. The image is downscaled to the models' 2576px max first.

const MAX_B64 = 32 * 1024 * 1024; // API request ceiling

export class AnthropicVisionProvider implements VisionProvider {
  readonly name = "anthropic";

  async analyzeStyle(input: StyleProfileInput): Promise<StyleProfile> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    const client = new Anthropic();
    const { data, mediaType } = await this.encode(input);

    const res = await client.messages.create(
      {
        model: config.visionModel,
        max_tokens: 2048,
        thinking: { type: "disabled" },
        output_config: {
          effort: "low",
          format: { type: "json_schema", schema: STYLE_PROFILE_SCHEMA as Record<string, unknown> },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data } },
              { type: "text", text: USER_PROMPT },
            ],
          },
        ],
      },
      { signal: input.signal },
    );

    if (res.stop_reason === "refusal") {
      throw new Error("REFUSAL: the vision model declined to analyze this image.");
    }
    if (res.stop_reason === "max_tokens") {
      throw new Error("Analysis response was truncated; please retry.");
    }

    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") throw new Error("No style profile returned.");

    let raw: StyleProfileModelOutput;
    try {
      raw = JSON.parse(block.text) as StyleProfileModelOutput;
    } catch {
      throw new Error("The vision model returned an unparseable style profile.");
    }

    return { ...raw, provider: this.name, fontMatch: computeFontMatch(raw.font) };
  }

  async ocr(input: StyleProfileInput): Promise<OcrResult> {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
    const client = new Anthropic();
    const { data, mediaType } = await this.encode(input);

    const res = await client.messages.create(
      {
        model: config.visionModel,
        max_tokens: 512,
        thinking: { type: "disabled" },
        system: OCR_SYSTEM,
        messages: [
          {
            role: "user",
            content: [{ type: "image", source: { type: "base64", media_type: mediaType, data } }],
          },
        ],
      },
      { signal: input.signal },
    );

    if (res.stop_reason === "refusal") return { provider: this.name, text: "" };
    const block = res.content.find((b) => b.type === "text");
    return { provider: this.name, text: block && block.type === "text" ? block.text.trim() : "" };
  }

  private async encode(
    input: StyleProfileInput,
  ): Promise<{ data: string; mediaType: "image/png" }> {
    const scaled = await ffmpegDownscale(input.imagePath);
    try {
      const data = (await readFile(scaled.path)).toString("base64").replace(/\r?\n/g, "");
      if (data.length > MAX_B64) throw new Error("Image is too large for the vision model.");
      return { data, mediaType: scaled.mediaType };
    } finally {
      await scaled.cleanup();
    }
  }
}
