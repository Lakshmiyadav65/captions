// Human-readable error copy for job failures (raw provider messages stay in DB/logs).

export function friendlyJobError(raw: string | null | undefined): string {
  if (!raw?.trim()) {
    return "Something went wrong while processing your video. You can try again.";
  }
  const m = raw.toLowerCase();
  if (m.includes("sarvam")) {
    if (m.includes("(401)") || m.includes("unauthorized") || m.includes("api key")) {
      return "The transcription service rejected the API key. Check your transcription API key in Vercel env.";
    }
    if (m.includes("(402)") || m.includes("credit") || m.includes("insufficient")) {
      return "Transcription credits are exhausted. Top up your provider balance, then retry.";
    }
    if (m.includes("(429)") || m.includes("rate")) {
      return "Transcription rate limit hit. Wait a minute and try again.";
    }
    if (m.includes("30") && (m.includes("second") || m.includes("duration"))) {
      return "This clip is a bit long for a single transcription pass. Click Try again — we’ll split the audio automatically.";
    }
    // Surface a short slice of the provider body so soft-launch debugging isn’t blind.
    const short = raw.length > 160 ? raw.slice(0, 157) + "…" : raw;
    return short;
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
  if (
    m.includes("caption minutes") ||
    m.includes("buy more minutes") ||
    m.includes("quota") ||
    m.includes("monthly limit")
  ) {
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
