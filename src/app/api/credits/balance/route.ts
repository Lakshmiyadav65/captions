import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { handleGetBalance } from "@/lib/credits-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await handleGetBalance(await requireUserId());
  return NextResponse.json(result.body, { status: result.status });
}
