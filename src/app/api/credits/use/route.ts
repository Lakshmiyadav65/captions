import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { InsufficientCreditsError, useMinutes } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    video_id?: string;
    videoId?: string;
    minutes?: number;
  };
  const minutes = Number(body.minutes);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return NextResponse.json({ error: "minutes must be greater than 0" }, { status: 400 });
  }

  const videoId = body.video_id ?? body.videoId;
  if (videoId) {
    const { prisma } = await import("@/lib/db");
    const job = await prisma.job.findUnique({
      where: { id: videoId },
      select: { userId: true },
    });
    if (!job || job.userId !== userId) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }
  }

  try {
    const result = await useMinutes({
      userId,
      minutes,
      videoId,
    });
    return NextResponse.json({
      available_minutes: result.availableMinutes,
      availableMinutes: result.availableMinutes,
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: 402 },
      );
    }
    const message = err instanceof Error ? err.message : "Could not use minutes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
