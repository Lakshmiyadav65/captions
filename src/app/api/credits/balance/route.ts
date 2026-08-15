import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { getAvailableMinutes } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const availableMinutes = await getAvailableMinutes(userId);
  return NextResponse.json({ available_minutes: availableMinutes, availableMinutes });
}
