// Caption generation: turn a user's idea/instruction + the analyzed style's vibe into ONE
// short, ORIGINAL Telugu caption for a Reel/Short. Mirrors the swappable transcription
// provider pattern (interface + registry + keyless mock). Output is native Telugu script;
// the route romanizes it when OUTPUT_MODE=translit, matching the rest of the app.

export interface GenerateOptions {
  /** A literal idea or an instruction, e.g. "a motivational line about starting today". */
  prompt: string;
  /** The analyzed style's vibe, used for TONE only (untrusted, truncated by the caller). */
  vibe?: string;
  signal?: AbortSignal;
}

export interface CaptionResult {
  provider: string;
  /** The generated caption in native Telugu script. */
  text: string;
}

export interface CaptionProvider {
  readonly name: string;
  generate(opts: GenerateOptions): Promise<CaptionResult>;
}
