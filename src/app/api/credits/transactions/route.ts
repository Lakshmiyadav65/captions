import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { listTransactions } from "@/lib/credits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }
  const rows = await listTransactions(userId);
  return NextResponse.json({
    transactions: rows.map((t) => ({
      id: t.id,
      type: t.type,
      minutes: t.minutes,
      balance_before: t.balanceBefore,
      balance_after: t.balanceAfter,
      video_id: t.videoId,
      description: t.description,
      status: t.status,
      created_at: t.createdAt.toISOString(),
    })),
  });
}
