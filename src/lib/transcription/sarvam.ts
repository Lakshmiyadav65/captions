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
import { groupWordsIntoSegments, splitTranscriptIntoSegments } from "./util";

// Sarvam AI Speech-to-Text (Saaras v3) — tuned for real, code-mixed Indian-language
// speech. The sync endpoint caps at ~30s of audio, so the worker feeds it ≤28s chunks
// (maxChunkSeconds). Sarvam returns word-level timestamps as parallel arrays, which we
// zip and then group into readable subtitle lines.

const ENDPOINT = "https://api.sarvam.ai/speech-to-text";

function toSarvamLang(code?: string): string {
  if (!code) return "unknown"; // let Sarvam auto-detect
  const c = code.toLowerCase();
  if (c === "te") return "te-IN";
  if (c === "unknown" || c === "auto") return "unknown";
  if (c.includes("-")) return code; // already like te-IN
  return `${c}-IN`;
}

function zipWords(timestamps: unknown): Word[] {
  const t = timestamps as
    | {
        words?: string[];
        start_time_seconds?: number[];
        end_time_seconds?: number[];
      }
    | undefined;
  if (!t?.words?.length) return [];
  const starts = t.start_time_seconds ?? [];
  const ends = t.end_time_seconds ?? [];
  return t.words.map((word, i) => ({
    text: word,
    start: starts[i] ?? 0,
    end: ends[i] ?? starts[i] ?? 0,
  }));
}

export class SarvamProvider implements TranscriptionProvider {
  readonly name = "sarvam";
  readonly maxChunkSeconds = 28;

  async transcribe(
    audioPath: string,
    opts: TranscribeOptions = {},
  ): Promise<TranscriptionResult> {
    const key = process.env.SARVAM_API_KEY;
    if (!key) throw new Error("SARVAM_API_KEY is not set");
    const model = process.env.SARVAM_MODEL || "saaras:v3";

    const buf = await readFile(audioPath);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buf)]), basename(audioPath));
    form.append("model", model);
    form.append("language_code", toSarvamLang(opts.language));
    // "transcribe" keeps the output in the spoken script (Telugu); saaras:v3 only.
    form.append("mode", process.env.SARVAM_MODE || "transcribe");

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "api-subscription-key": key },
      body: form,
      signal: opts.signal,
    });
    if (!res.ok) {
      throw new Error(
        `Sarvam transcription failed (${res.status}): ${await res.text()}`,
      );
    }

    const json = (await res.json()) as {
      transcript?: string;
      language_code?: string | null;
      timestamps?: unknown;
    };

    const words = zipWords(json.timestamps);
    let segments: Segment[];
    if (words.length) {
      segments = groupWordsIntoSegments(words);
    } else if (json.transcript) {
      // No timestamps came back — distribute the transcript across the chunk length.
      segments = splitTranscriptIntoSegments(
        json.transcript,
        opts.durationSec ?? 0,
      );
    } else {
      segments = [];
    }

    return {
      language: normalizeLanguage(json.language_code || "te"),
      provider: this.name,
      segments,
    };
  }
}
