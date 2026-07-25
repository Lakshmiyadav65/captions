// Human-readable error copy for job failures (raw provider messages stay in DB/logs).

export function friendlyJobError(raw: string | null | undefined): string {
  if (!raw?.trim()) {
    return "Something went wrong while processing your video. You can try again.";
  }
  const m = raw.toLowerCase();
  if (m.includes("sarvam")) {
    return "Transcription service had a problem. Check your Sarvam API key or try again in a moment.";
  }
  if (m.includes("openai") || m.includes("whisper")) {
    return "OpenAI transcription failed. Check your API key or switch ASR_PROVIDER.";
  }
  if (m.includes("ffmpeg") || m.includes("extract")) {
    return "Couldn't read audio from this video. Try re-exporting as MP4 (H.264) and upload again.";
  }
  if (m.includes("too long") || (m.includes("max") && m.includes("minute"))) {
    return "This video is longer than your plan allows. Trim it or raise MAX_VIDEO_MINUTES.";
  }
  if (m.includes("quota") || m.includes("monthly limit")) {
    return raw;
  }
  if (m.includes("enospc") || m.includes("no space")) {
    return "Server storage is full. Free space or switch to S3/R2 storage.";
  }
  // Keep short technical detail for power users, but lead with calm copy.
  const short = raw.length > 180 ? raw.slice(0, 177) + "…" : raw;
  return `Processing failed: ${short}`;
}

export function isQuotaError(status: number, body?: { code?: string; error?: string }): boolean {
  if (status !== 429) return false;
  if (body?.code?.startsWith("quota_") || body?.code === "rate_limit") return true;
  const e = (body?.error ?? "").toLowerCase();
  return e.includes("limit") || e.includes("processing") || e.includes("too many");
}
