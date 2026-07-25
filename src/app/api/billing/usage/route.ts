import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { usageSummary } from "@/lib/quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    if (userId === null) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }
    const usage = await usageSummary(userId);
    return NextResponse.json(usage);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not load usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
