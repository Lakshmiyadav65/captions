import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The signed-in user's custom spelling dictionary. GET lists rules; POST adds/updates one
// (unique per `from`); DELETE removes one by id. Rules are applied to new transcripts in
// the processor and on demand in the editor.

export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const rules = await prisma.spellingRule.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, from: true, to: true },
  });
  return NextResponse.json({ rules });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as { from?: string; to?: string };
  const from = body.from?.trim();
  const to = body.to?.trim();
  if (!from || !to) {
    return NextResponse.json({ error: "Both 'from' and 'to' are required." }, { status: 400 });
  }
  const rule = await prisma.spellingRule.upsert({
    where: { userId_from: { userId, from } },
    update: { to },
    create: { userId, from, to },
    select: { id: true, from: true, to: true },
  });
  return NextResponse.json({ rule });
}

export async function DELETE(req: Request) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  // Scope the delete to the owner so nobody can remove another user's rule.
  await prisma.spellingRule.deleteMany({ where: { id, userId } });
  return NextResponse.json({ ok: true });
}
