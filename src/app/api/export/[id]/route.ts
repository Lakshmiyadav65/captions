import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { config } from "@/lib/config";
import {
  burnCaptionedMp4,
  resolveExportFilename,
  type ExportBurnInput,
  type ExportBurnProgress,
} from "@/lib/export-burn";
import type { SubtitleStyle } from "@/lib/subtitles";
import { reportError } from "@/lib/sentry";
import type { Segment } from "@/lib/transcription/types";
import { validateExportBasename } from "@/lib/export-filename";
import {
  ACTIVE_EXPORT_STATUSES,
  friendlyExportError,
  isActiveExportStatus,
  type ExportProgressEvent,
} from "@/lib/export-job";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface Body {
  style?: Partial<SubtitleStyle>;
  segments?: Segment[];
  filename?: string;
  stream?: boolean;
}

const STALE_MS = 20 * 60 * 1000;

async function loadOwnedJob(id: string, userId: string) {
  const job = await prisma.job.findUnique({
    where: { id },
    include: { transcript: true },
  });
  if (!job || job.userId !== userId) return null;
  return job;
}

async function claimExport(jobId: string, filename: string): Promise<boolean> {
  const stale = new Date(Date.now() - STALE_MS);
  const claimed = await prisma.job.updateMany({
    where: {
      id: jobId,
      OR: [
        { exportStatus: { notIn: [...ACTIVE_EXPORT_STATUSES] } },
        { updatedAt: { lt: stale } },
      ],
    },
    data: {
      exportStatus: "queued",
      exportProgress: 0,
      exportFilename: filename,
      exportError: null,
      exportUrl: null,
      exportKey: null,
    },
  });
  return claimed.count > 0;
}

async function persistExport(
  jobId: string,
  data: {
    exportStatus?: string;
    exportProgress?: number;
    exportFilename?: string;
    exportError?: string | null;
    exportUrl?: string | null;
    exportKey?: string | null;
  },
) {
  await prisma.job.update({ where: { id: jobId }, data }).catch(() => undefined);
}

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to export." }, { status: 401 });
  }

  const job = await loadOwnedJob(id, userId);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let url = job.exportUrl;
  if (job.exportStatus === "completed" && job.exportKey && !url) {
    try {
      url = await getStorage().getUrl(job.exportKey);
    } catch {
      /* keep stored url */
    }
  }

  return NextResponse.json({
    status: job.exportStatus,
    progress: job.exportProgress,
    filename: job.exportFilename,
    url: job.exportStatus === "completed" ? url : null,
    error: job.exportStatus === "failed" ? job.exportError : null,
  });
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

  const job = await loadOwnedJob(id, userId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!job.videoKey || job.status !== "done" || !job.transcript) {
    return NextResponse.json(
      { error: "Captions are not ready yet." },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const filenameCheck = body.filename
    ? validateExportBasename(body.filename)
    : { ok: true as const, filename: resolveExportFilename(undefined, job.originalName), basename: "" };
  if (!filenameCheck.ok) {
    return NextResponse.json({ error: filenameCheck.error }, { status: 400 });
  }
  const filename = filenameCheck.filename;

  const wantsStream =
    body.stream === true ||
    (req.headers.get("accept") ?? "").includes("text/event-stream");

  if (isActiveExportStatus(job.exportStatus) && Date.now() - job.updatedAt.getTime() < STALE_MS) {
    return NextResponse.json(
      {
        error: "Export already in progress.",
        status: job.exportStatus,
        progress: job.exportProgress,
        filename: job.exportFilename,
      },
      { status: 409 },
    );
  }

  const claimed = await claimExport(job.id, filename);
  if (!claimed) {
    return NextResponse.json(
      { error: "Export already in progress." },
      { status: 409 },
    );
  }

  const segments = Array.isArray(body.segments)
    ? body.segments
    : (JSON.parse(job.transcript.segments) as Segment[]);

  const input: ExportBurnInput = {
    jobId: job.id,
    videoKey: job.videoKey,
    originalName: job.originalName,
    durationSec: job.durationSec,
    segments,
    style: body.style ?? {},
    downloadFilename: filename,
  };

  if (process.env.VERCEL && !config.usesBull && (job.durationSec ?? 0) > 180) {
    await persistExport(job.id, {
      exportStatus: "failed",
      exportError: "This clip is longer than ~3 minutes for Export video on the free host.",
    });
    return NextResponse.json(
      {
        error:
          "This clip is longer than ~3 minutes for Export video on the free host. Download SRT/VTT instead, or trim the video and retry.",
      },
      { status: 413 },
    );
  }

  if (!wantsStream) {
    try {
      const result = await runExport(input);
      return NextResponse.json({ url: result.url, filename: result.filename });
    } catch (err) {
      const message = await failExport(job.id, err, userId);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ExportProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      send({ status: "queued", progress: 0, filename });
      try {
        const result = await runExport(input, (update) => {
          send({
            status: update.status,
            progress: update.percent,
            filename,
            renderedSec: update.renderedSec,
            totalSec: update.totalSec,
          });
        });
        send({
          status: "completed",
          progress: 100,
          filename: result.filename,
          url: result.url,
        });
      } catch (err) {
        const message = await failExport(job.id, err, userId);
        send({ status: "failed", progress: 0, filename, error: message });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}

async function runExport(
  input: ExportBurnInput,
  onProgress?: (update: ExportBurnProgress) => void,
) {
  const persistProgress = async (update: ExportBurnProgress) => {
    onProgress?.(update);
    await persistExport(input.jobId, {
      exportStatus: update.status,
      exportProgress: update.percent,
    });
  };

  if (!config.usesBull) {
    const result = await burnCaptionedMp4(input, { onProgress: persistProgress });
    await persistExport(input.jobId, {
      exportStatus: "completed",
      exportProgress: 100,
      exportFilename: result.filename,
      exportUrl: result.url,
      exportKey: result.key,
      exportError: null,
    });
    return result;
  }

  const pending = (await import("@/lib/queue/bull")).enqueueExportAndWait(input);
  const poll = setInterval(() => {
    void prisma.job
      .findUnique({
        where: { id: input.jobId },
        select: { exportStatus: true, exportProgress: true },
      })
      .then((row) => {
        if (!row || !isActiveExportStatus(row.exportStatus)) return;
        onProgress?.({
          percent: row.exportProgress,
          status: row.exportStatus as ExportBurnProgress["status"],
        });
      })
      .catch(() => undefined);
  }, 400);

  try {
    const result = await pending;
    await persistExport(input.jobId, {
      exportStatus: "completed",
      exportProgress: 100,
      exportFilename: result.filename,
      exportUrl: result.url,
      exportKey: result.key,
      exportError: null,
    });
    return result;
  } finally {
    clearInterval(poll);
  }
}

async function failExport(jobId: string, err: unknown, userId: string): Promise<string> {
  const raw = err instanceof Error ? err.message : "Export failed";
  const message = friendlyExportError(raw);
  await persistExport(jobId, {
    exportStatus: "failed",
    exportError: message,
  });
  await reportError("export.route_failed", err, { jobId, userId });
  return message;
}
