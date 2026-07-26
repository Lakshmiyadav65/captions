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
const MAX_ATTEMPTS = 3;

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504;
}

export class SarvamProvider implements TranscriptionProvider {
  readonly name = "sarvam";
  readonly maxChunkSeconds = 28;

  async transcribe(
    audioPath: string,
    opts: TranscribeOptions = {},
  ): Promise<TranscriptionResult> {
    const key = process.env.SARVAM_API_KEY?.trim();
    if (!key) throw new Error("SARVAM_API_KEY is not set");
    const model = process.env.SARVAM_MODEL || "saaras:v3";
    const mode = process.env.SARVAM_MODE || "transcribe";

    const buf = await readFile(audioPath);
    const filename = basename(audioPath) || "audio.wav";
    // Explicit WAV type — some gateways reject nameless octet-stream Blobs.
    const file = new File([buf], filename, { type: "audio/wav" });

    let lastErr = "Sarvam transcription failed";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const form = new FormData();
      form.append("file", file);
      form.append("model", model);
      form.append("language_code", toSarvamLang(opts.language));
      form.append("mode", mode);
      form.append("with_timestamps", "true");

      let res: Response;
      try {
        res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "api-subscription-key": key },
          body: form,
          signal: opts.signal,
        });
      } catch (err) {
        lastErr = `Sarvam network error: ${err instanceof Error ? err.message : String(err)}`;
        if (attempt < MAX_ATTEMPTS) {
          await sleep(500 * attempt);
          continue;
        }
        throw new Error(lastErr);
      }

      if (res.ok) {
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

      const body = (await res.text()).slice(0, 500);
      lastErr = `Sarvam transcription failed (${res.status}): ${body || res.statusText}`;
      if (attempt < MAX_ATTEMPTS && shouldRetry(res.status)) {
        await sleep(700 * attempt);
        continue;
      }
      throw new Error(lastErr);
    }

    throw new Error(lastErr);
  }
}
