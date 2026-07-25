import { log } from "./log";

// Optional Sentry reporting. No SDK dependency — posts a minimal event when
// SENTRY_DSN is set. Safe no-op when unset (local / keyless demos).

type CaptureContext = {
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  level?: "error" | "warning" | "info";
};

let warnedMissing = false;

function parseDsn(dsn: string): {
  publicKey: string;
  host: string;
  projectId: string;
} | null {
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\//, "").split("/")[0];
    if (!projectId || !u.username) return null;
    return { publicKey: u.username, host: u.host, projectId };
  } catch {
    return null;
  }
}

export async function captureException(
  err: unknown,
  context: CaptureContext = {},
): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return;

  const parsed = parseDsn(dsn);
  if (!parsed) {
    if (!warnedMissing) {
      warnedMissing = true;
      log.warn("sentry.dsn_invalid");
    }
    return;
  }

  const error =
    err instanceof Error
      ? err
      : new Error(typeof err === "string" ? err : "Unknown error");

  const envelopeHeader = JSON.stringify({
    dsn,
    sent_at: new Date().toISOString(),
  });
  const itemHeader = JSON.stringify({
    type: "event",
    content_type: "application/json",
  });
  const event = JSON.stringify({
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: Date.now() / 1000,
    platform: "node",
    level: context.level ?? "error",
    server_name: process.env.HOSTNAME || "captions",
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE,
    message: error.message,
    exception: {
      values: [
        {
          type: error.name,
          value: error.message,
          stacktrace: error.stack
            ? {
                frames: error.stack
                  .split("\n")
                  .slice(1, 20)
                  .map((line) => ({ filename: line.trim() })),
              }
            : undefined,
        },
      ],
    },
    tags: context.tags,
    extra: context.extra,
  });

  const url = `https://${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: `${envelopeHeader}\n${itemHeader}\n${event}`,
    });
    if (!res.ok) {
      log.warn("sentry.send_failed", { status: res.status });
    }
  } catch (sendErr) {
    log.warn("sentry.send_error", { err: sendErr });
  }
}

/** Log + optionally report. Prefer this at catch sites. */
export async function reportError(
  msg: string,
  err: unknown,
  fields: Record<string, unknown> = {},
): Promise<void> {
  log.error(msg, { ...fields, err });
  const tags: Record<string, string> = {};
  if (typeof fields.jobId === "string") tags.jobId = fields.jobId;
  if (typeof fields.userId === "string") tags.userId = fields.userId;
  await captureException(err, { tags, extra: fields });
}
