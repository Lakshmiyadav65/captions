import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  normalizeLanguage,
  type Segment,
  type TranscribeOptions,
  type TranscriptionProvider,
  type TranscriptionResult,
} from "./types";

// OpenAI transcription. Defaults to whisper-1 because its verbose_json response returns
// segment-level timestamps directly (needed for subtitle timing). Handles multi-minute
// audio in one request (25 MB limit ≈ 13 min of 16 kHz mono WAV); the worker chunks longer.

export class OpenAIProvider implements TranscriptionProvider {
  readonly name = "openai";
  readonly maxChunkSeconds = 600;

  async transcribe(
    audioPath: string,
    opts: TranscribeOptions = {},
  ): Promise<TranscriptionResult> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set");
    const model = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

    const buf = await readFile(audioPath);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)]), basename(audioPath));
    form.append("model", model);
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");
    if (opts.language) form.append("language", opts.language);

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: opts.signal,
    });
    if (!res.ok) {
      throw new Error(
        `OpenAI transcription failed (${res.status}): ${await res.text()}`,
      );
    }

    const json = (await res.json()) as {
      language?: string;
      duration?: number;
      text?: string;
      segments?: Array<{ start: number; end: number; text: string }>;
    };

    const segments: Segment[] = (json.segments ?? []).map((s) => ({
      start: s.start,
      end: s.end,
      text: (s.text ?? "").trim(),
    }));

    return {
      language: normalizeLanguage(json.language),
      provider: this.name,
      segments,
    };
  }
}
