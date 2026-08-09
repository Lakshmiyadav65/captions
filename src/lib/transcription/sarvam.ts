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

// Sarvam AI Speech-to-Text (Saaras) — tuned for real, code-mixed Indian-language
// speech. The sync endpoint caps at ~30s of audio, so the worker feeds it ≤28s chunks
// (maxChunkSeconds). Prefer `codemix` so English stays Latin and Telugu stays Telugu —
// `transcribe` writes English phonetically in Telugu script and destroys accuracy.

const ENDPOINT = "https://api.sarvam.ai/speech-to-text";
const MAX_ATTEMPTS = 3;
/** Prefer v4; fall back to v3 if the account/API rejects it. */
const DEFAULT_MODEL = "saaras:v4";
const FALLBACK_MODEL = "saaras:v3";
/** Codemix keeps English as English — critical for Telugu creator speech. */
const DEFAULT_MODE = "codemix";

export function sarvamRuntimeConfig() {
  return {
    model: process.env.SARVAM_MODEL?.trim() || DEFAULT_MODEL,
    mode: process.env.SARVAM_MODE?.trim() || DEFAULT_MODE,
  };
}

function toSarvamLang(code?: string): string {
  if (!code) return "unknown"; // let Sarvam auto-detect
  const c = code.toLowerCase();
  if (c === "te") return "te-IN";
  if (c === "unknown" || c === "auto") return "unknown";
  if (c.includes("-")) return code; // already like te-IN
  return `${c}-IN`;
}

function asNumArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((n) => (typeof n === "number" ? n : Number(n)))
    .filter((n) => Number.isFinite(n));
}

/**
 * Sarvam shape has varied across models/modes:
 * - start_time_seconds/end_time_seconds (seconds)
 * - start_time/end_time (often milliseconds)
 * - start/end (provider-dependent units)
 */
function zipWords(timestamps: unknown, durationSec?: number): Word[] {
  const t = timestamps as
    | {
        words?: string[];
        start_time_seconds?: unknown;
        end_time_seconds?: unknown;
        start_time?: unknown;
        end_time?: unknown;
        start?: unknown;
        end?: unknown;
      }
    | undefined;
  if (!t?.words?.length) return [];

  const startsSec = asNumArray(t.start_time_seconds);
  const endsSec = asNumArray(t.end_time_seconds);
  const startsGeneric = asNumArray(t.start_time);
  const endsGeneric = asNumArray(t.end_time);
  const startsBare = asNumArray(t.start);
  const endsBare = asNumArray(t.end);

  let starts = startsSec.length ? startsSec : startsGeneric.length ? startsGeneric : startsBare;
  let ends = endsSec.length ? endsSec : endsGeneric.length ? endsGeneric : endsBare;

  const maxTs = Math.max(0, ...starts, ...ends);
  const dur = durationSec && durationSec > 0 ? durationSec : undefined;
  const probablyMillis =
    maxTs > 200 ||
    (dur !== undefined && maxTs > dur * 2.5);
  if (probablyMillis) {
    starts = starts.map((v) => v / 1000);
    ends = ends.map((v) => v / 1000);
  }

  // Ensure sane, non-negative, forward ranges.
  return t.words.map((word, i) => {
    const start = Math.max(0, starts[i] ?? 0);
    const end = Math.max(start, ends[i] ?? start);
    return {
    text: word,
    start,
    end,
  };
  });
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
    let model = sarvamRuntimeConfig().model;
    const mode = sarvamRuntimeConfig().mode;
    const modelPinned = Boolean(process.env.SARVAM_MODEL?.trim());

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

        const words = zipWords(json.timestamps, opts.durationSec);
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

      // Auto-selected v4 rejected → retry once with v3.
      if (
        !modelPinned &&
        model === DEFAULT_MODEL &&
        (res.status === 400 || res.status === 404 || res.status === 422)
      ) {
        model = FALLBACK_MODEL;
        continue;
      }

      if (attempt < MAX_ATTEMPTS && shouldRetry(res.status)) {
        await sleep(700 * attempt);
        continue;
      }
      throw new Error(lastErr);
    }

    throw new Error(lastErr);
  }
}
