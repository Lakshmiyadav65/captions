import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/jobs — list the current user's projects (newest first). */
export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to view projects." }, { status: 401 });
  }

  const jobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      progress: true,
      originalName: true,
      durationSec: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      progress: j.progress,
      originalName: j.originalName ?? "Untitled video",
      durationSec: j.durationSec,
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
  });
}
