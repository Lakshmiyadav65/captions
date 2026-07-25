import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { usageSummary } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const usage = await usageSummary(userId);
  return NextResponse.json(usage);
}
