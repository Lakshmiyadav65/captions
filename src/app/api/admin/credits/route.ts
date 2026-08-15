import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthed } from "@/lib/admin-auth";
import { adjustMinutes } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    minutes?: number;
    description?: string;
  };
  const email = body.email?.trim().toLowerCase();
  const minutes = Number(body.minutes);
  if (!email || !Number.isFinite(minutes) || minutes === 0) {
    return NextResponse.json(
      { error: "email and non-zero minutes are required" },
      { status: 400 },
    );
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email } },
    select: { id: true, email: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const result = await adjustMinutes({
    userId: user.id,
    minutes,
    description: body.description?.trim() || "Admin adjustment",
  });
  return NextResponse.json({
    email: user.email,
    available_minutes: result.availableMinutes,
  });
}
