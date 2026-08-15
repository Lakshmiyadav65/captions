import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { assertWithinQuota } from "@/lib/quota";
import { enqueueJob } from "@/lib/queue";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Re-run a failed job without re-uploading. Resets status → queued and enqueues again.

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to retry." }, { status: 401 });
  }

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.userId && job.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (job.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed jobs can be retried.", code: "not_failed" },
      { status: 400 },
    );
  }
  if (!job.videoKey) {
    return NextResponse.json(
      { error: "Video file is missing — please upload again.", code: "no_video" },
      { status: 400 },
    );
  }

  const quota = await assertWithinQuota(userId);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.reason, code: quota.code },
      { status: 429 },
    );
  }

  // Drop a stale BullMQ entry so the same job id can be enqueued again.
  if (process.env.QUEUE_DRIVER === "bullmq") {
    try {
      const { getQueue } = await import("@/lib/queue/bull");
      const existing = await getQueue().getJob(id);
      if (existing) await existing.remove();
    } catch {
      // inline / redis down — enqueueJob will surface if needed
    }
  }

  await prisma.job.update({
    where: { id },
    data: { status: "queued", progress: 0, error: null },
  });
  await enqueueJob(id);
  log.info("job.retry", { jobId: id, userId });

  return NextResponse.json({ id, status: "queued" });
}
