import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueJob } from "@/lib/queue";
import { requireUserId } from "@/lib/auth-helpers";
import { assertWithinQuota } from "@/lib/quota";
import { log } from "@/lib/log";
import { reportError } from "@/lib/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Inline ASR runs via `after()` on this request — Hobby max is 300s.
export const maxDuration = 300;

function isVercelBlobUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith("blob.vercel-storage.com");
  } catch {
    return false;
  }
}

/**
 * After the browser uploads directly to Vercel Blob, create the job and enqueue ASR.
 * Body: { url, filename? }
 */
export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    filename?: string;
  };
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!isVercelBlobUrl(url)) {
    return NextResponse.json({ error: "Invalid upload URL." }, { status: 400 });
  }

  const quota = await assertWithinQuota(userId);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.reason, code: quota.code },
      { status: 429 },
    );
  }

  const originalName = (body.filename || "video.mp4").slice(0, 200);

  try {
    const job = await prisma.job.create({
      data: {
        status: "queued",
        originalName,
        userId,
        videoKey: url,
      },
    });
    await enqueueJob(job.id);
    log.info("upload.blob_enqueued", { jobId: job.id, userId });
    return NextResponse.json({ id: job.id });
  } catch (err) {
    await reportError("upload.blob_complete_failed", err, { userId });
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
