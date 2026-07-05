import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Segment } from "@/lib/transcription/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET the generated segments for a job; PUT to save user edits (fixed text / timings).

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const t = await prisma.transcript.findUnique({ where: { jobId: id } });
  if (!t) {
    return NextResponse.json({ error: "Transcript not ready" }, { status: 404 });
  }
  return NextResponse.json({
    language: t.language,
    segments: JSON.parse(t.segments) as Segment[],
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await req.json()) as { segments?: Segment[] };
  if (!Array.isArray(body.segments)) {
    return NextResponse.json({ error: "segments[] required" }, { status: 400 });
  }
  await prisma.transcript.update({
    where: { jobId: id },
    data: { segments: JSON.stringify(body.segments) },
  });
  return NextResponse.json({ ok: true });
}
