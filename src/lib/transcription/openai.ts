import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  normalizeLanguage,
  type Segment,
  type TranscribeOptions,
  type TranscriptionProvider,
  type TranscriptionResult,
  type Word,
} from "./types";
import { groupWordsIntoSegments } from "./util";

// OpenAI transcription. Defaults to whisper-1 because its verbose_json response returns
// timestamps (needed for subtitle timing). Requests both segment + word granularities so
// karaoke can use real word times. Handles multi-minute audio in one request (25 MB limit
// ≈ 13 min of 16 kHz mono WAV); the worker chunks longer.

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
    form.append("timestamp_granularities[]", "word");
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
      words?: Array<{ word: string; start: number; end: number }>;
    };

    const flatWords: Word[] = (json.words ?? [])
      .map((w) => ({
        text: (w.word ?? "").trim(),
        start: w.start,
        end: w.end,
      }))
      .filter((w) => w.text.length > 0);

    let segments: Segment[];
    if (json.segments?.length) {
      segments = json.segments.map((s) => {
        const text = (s.text ?? "").trim();
        const words = flatWords.filter((w) => {
          const mid = (w.start + w.end) / 2;
          return mid >= s.start - 0.05 && mid <= s.end + 0.05;
        });
        return {
          start: s.start,
          end: s.end,
          text,
          words: words.length ? words : undefined,
        };
      });
    } else if (flatWords.length) {
      segments = groupWordsIntoSegments(flatWords);
    } else {
      segments = [];
    }

    return {
      language: normalizeLanguage(json.language),
      provider: this.name,
      segments,
    };
  }
}

/** Flatten word timings from an OpenAI TranscriptionResult (for TIMING_PROVIDER refine). */
export function flattenWords(result: TranscriptionResult): Word[] {
  const out: Word[] = [];
  for (const s of result.segments) {
    if (s.words?.length) {
      out.push(...s.words.map((w) => ({ ...w })));
    }
  }
  return out;
}
