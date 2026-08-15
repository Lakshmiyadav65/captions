import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth-helpers";
import { handleUseMinutes } from "@/lib/credits-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const result = await handleUseMinutes(await requireUserId(), body);
  return NextResponse.json(result.body, { status: result.status });
}
