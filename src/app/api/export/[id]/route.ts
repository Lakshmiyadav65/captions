import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStorage, type LocalFile } from "@/lib/storage";
import { burnSubtitles } from "@/lib/ffmpeg";
import { toASS, DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles";
import { fontsDir } from "@/lib/subtitles/fonts-dir";
import type { Segment } from "@/lib/transcription/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Burning re-encodes the whole video; allow long-running requests on a container host.
export const maxDuration = 600;

// POST /api/export/[id] — render the current captions + style permanently into the video
// and return a URL to the finished MP4. The client sends its live style and (possibly
// unsaved) segments so the burned file matches exactly what the editor previews.

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
  const style: SubtitleStyle = { ...DEFAULT_STYLE, ...(body.style ?? {}) };
  const ass = toASS(segments, style);

  const storage = getStorage();
  let localVideo: LocalFile | null = null;
  let workDir: string | null = null;

  try {
    localVideo = await storage.toLocalFile(job.videoKey);
    workDir = await mkdtemp(join(tmpdir(), "captions-burn-"));
    const outPath = join(workDir, "captioned.mp4");

    await burnSubtitles(localVideo.path, ass, outPath, {
      fontsDir: fontsDir(),
      totalSec: job.durationSec ?? undefined,
    });

    const key = `exports/${job.id}/captioned.mp4`;
    await storage.put(key, createReadStream(outPath), { contentType: "video/mp4" });

    const url = await storage.getUrl(key);
    const filename = `${(job.originalName ?? "telugu-captions").replace(/\.[^.]+$/, "")}-captioned.mp4`;
    return NextResponse.json({ url, filename });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (localVideo) await localVideo.cleanup().catch(() => {});
  }
}
