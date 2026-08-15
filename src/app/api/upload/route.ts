import { NextRequest, NextResponse } from "next/server";
import { extname } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { config } from "@/lib/config";
import { prisma, friendlyDbError } from "@/lib/db";
import { enqueueJob } from "@/lib/queue";
import { getStorage } from "@/lib/storage";
import { requireUserId } from "@/lib/auth-helpers";
import { assertWithinQuota } from "@/lib/quota";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";
import { reportError } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The client streams the raw video as the request body; we pipe it straight into storage
// (local disk or S3) without buffering. Auth + quotas are enforced before accepting bytes.

function safeExt(name: string): string {
  const e = extname(name).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(e) ? e : ".mp4";
}

function dbMisconfiguredMessage(err: unknown): string | null {
  return friendlyDbError(err);
}

export async function POST(req: NextRequest) {
  try {
    if (!req.body) {
      return NextResponse.json({ error: "No file in request body." }, { status: 400 });
    }

    // Auth (no-op / dev user when AUTH_ENABLED=false).
    const userId = await requireUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    const rate = await assertUploadRateLimit(userId, ip);
    if (!rate.ok) {
      log.warn("upload.rate_limited", { userId, ip, retryAfterSec: rate.retryAfterSec });
      return NextResponse.json(
        { error: "Too many uploads. Try again shortly.", code: "rate_limit" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }

    // Reject over-size uploads up front via Content-Length.
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared && declared > config.limits.maxUploadBytes) {
      return NextResponse.json(
        { error: `File too large. Max ${config.limits.maxUploadMB} MB.` },
        { status: 413 },
      );
    }

    const quota = await assertWithinQuota(userId);
    if (!quota.ok) {
      return NextResponse.json(
        { error: quota.reason, code: quota.code },
        { status: 429 },
      );
    }

    const originalName = decodeURIComponent(
      req.headers.get("x-filename") || "video.mp4",
    );
    const ext = safeExt(originalName);

    const job = await prisma.job.create({
      data: { status: "queued", originalName, userId },
    });

    const key = `uploads/${job.id}/source${ext}`;
    const storage = getStorage();

    try {
      const nodeStream = Readable.fromWeb(
        req.body as unknown as NodeWebReadableStream,
      );
      await storage.put(key, nodeStream, {
        contentType: req.headers.get("content-type") ?? undefined,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      await prisma.job.update({
        where: { id: job.id },
        data: { status: "failed", error: message.slice(0, 500) },
      }).catch(() => {});
      await reportError("upload.store_failed", err, { jobId: job.id, userId });
      return NextResponse.json({ error: message }, { status: 500 });
    }

    await prisma.job.update({ where: { id: job.id }, data: { videoKey: key } });
    await enqueueJob(job.id);
    log.info("upload.enqueued", { jobId: job.id, userId, bytes: declared || undefined });

    return NextResponse.json({ id: job.id });
  } catch (err) {
    const dbMsg = dbMisconfiguredMessage(err);
    const message =
      dbMsg ?? (err instanceof Error ? err.message : "Upload failed");
    log.error("upload.failed", { err });
    await reportError("upload.failed", err);
    return NextResponse.json(
      { error: message, code: dbMsg ? "db_misconfigured" : "upload_failed" },
      { status: 500 },
    );
  }
}
