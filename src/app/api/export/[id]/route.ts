import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { config } from "@/lib/config";
import { burnCaptionedMp4 } from "@/lib/export-burn";
import type { SubtitleStyle } from "@/lib/subtitles";
import { reportError } from "@/lib/sentry";
import type { Segment } from "@/lib/transcription/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel Hobby max 300s. On Docker/BullMQ the worker does the burn; this route mostly waits.
export const maxDuration = 300;

// POST /api/export/[id] — burn captions + style into an MP4.
// Production (QUEUE_DRIVER=bullmq): enqueue to the export worker and wait for the result.
// Local/inline: burn in-process (dev convenience).

interface Body {
  style?: Partial<SubtitleStyle>;
  segments?: Segment[];
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to export." }, { status: 401 });
  }

  const job = await prisma.job.findUnique({
    where: { id },
    include: { transcript: true },
  });
  if (!job || job.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!job.videoKey || job.status !== "done" || !job.transcript) {
    return NextResponse.json(
      { error: "Captions are not ready yet." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const segments = Array.isArray(body.segments)
    ? body.segments
    : (JSON.parse(job.transcript.segments) as Segment[]);

  const input = {
    jobId: job.id,
    videoKey: job.videoKey,
    originalName: job.originalName,
    durationSec: job.durationSec,
    segments,
    style: body.style ?? {},
  };

  try {
    if (config.usesBull) {
      const { enqueueExportAndWait } = await import("@/lib/queue/bull");
      const result = await enqueueExportAndWait(input);
      return NextResponse.json({ url: result.url, filename: result.filename });
    }

    const result = await burnCaptionedMp4(input);
    return NextResponse.json({ url: result.url, filename: result.filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    await reportError("export.route_failed", err, { jobId: job.id, userId });
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  }
}
