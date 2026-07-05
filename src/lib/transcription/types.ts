// Shared transcription model. Every provider normalizes its response into these types,
// so the rest of the app (worker, UI, subtitle exporters) never depends on a specific vendor.

export interface Word {
  start: number; // seconds from start of media
  end: number; // seconds from start of media
  text: string;
}

export interface Segment {
  start: number; // seconds
  end: number; // seconds
  text: string;
  words?: Word[];
}

export interface TranscriptionResult {
  /** BCP-47-ish language code we normalize to, e.g. "te" for Telugu. */
  language: string;
  segments: Segment[];
  /** Which provider produced this result. */
  provider: string;
}

export interface TranscribeOptions {
  /** Language hint (e.g. "te"). Omit to let the provider auto-detect. */
  language?: string;
  /** Duration of the audio being sent, so timestamp-less providers can space out text. */
  durationSec?: number;
  /** Allows the worker to cancel an in-flight request. */
  signal?: AbortSignal;
}

/**
 * A pluggable speech-to-text backend. Add a new vendor by implementing this
 * interface and registering it in ./index.ts — nothing else in the app changes.
 */
export interface TranscriptionProvider {
  readonly name: string;
  /** Max audio length this provider accepts per request; the worker chunks past it. */
  readonly maxChunkSeconds?: number;
  transcribe(
    audioPath: string,
    opts?: TranscribeOptions,
  ): Promise<TranscriptionResult>;
}

/** Normalize assorted language names/codes to a short code we use internally. */
export function normalizeLanguage(input: string | null | undefined): string {
  if (!input) return "unknown";
  const v = input.trim().toLowerCase();
  const map: Record<string, string> = {
    telugu: "te",
    "te-in": "te",
    te: "te",
    english: "en",
    "en-in": "en",
    en: "en",
    hindi: "hi",
    "hi-in": "hi",
    hi: "hi",
  };
  return map[v] ?? v;
}
