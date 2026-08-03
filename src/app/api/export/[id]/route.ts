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

    // Hobby serverless burns are fragile for long clips — fail fast with a clear tip.
    if (process.env.VERCEL && (job.durationSec ?? 0) > 180) {
      return NextResponse.json(
        {
          error:
            "This clip is longer than ~3 minutes for Export video on the free host. Download SRT/VTT instead, or trim the video and retry.",
        },
        { status: 413 },
      );
    }

    const result = await burnCaptionedMp4(input);
    return NextResponse.json({ url: result.url, filename: result.filename });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Export failed";
    let message = raw;
    if (/timeout|TIMED_OUT|FUNCTION_INVOCATION|canceled|AbortError|504|502/i.test(raw)) {
      message =
        "Export timed out while burning captions. Try a shorter clip (under ~2 min), or download SRT/VTT and burn elsewhere.";
    } else if (/ENOENT|fonts|no such file/i.test(raw)) {
      message =
        "Export fonts/binary missing on the server. Redeploy, or download SRT/VTT as a backup.";
    } else if (/ENOMEM|out of memory|killed|signal/i.test(raw)) {
      message =
        "Export ran out of memory on the free host. Try a shorter/lower-res clip, or download SRT/VTT.";
    } else if (/spawn|EACCES|permission denied|ffmpeg/i.test(raw) && /error|fail|exit/i.test(raw)) {
      message =
        "Couldn't run the video encoder on the server. Retry once; if it keeps failing, download SRT/VTT.";
    }
    await reportError("export.route_failed", err, { jobId: job.id, userId });
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  }
}
