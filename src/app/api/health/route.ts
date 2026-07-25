import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lightweight probe for deploy debugging (no secrets). */
export async function GET() {
  const out: {
    ok: boolean;
    db: "ok" | "error";
    dbError?: string;
    storage: string;
    queue: string;
    vercel: boolean;
  } = {
    ok: true,
    db: "ok",
    storage: config.storageDriver,
    queue: config.queueDriver,
    vercel: Boolean(process.env.VERCEL),
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    out.ok = false;
    out.db = "error";
    const message = err instanceof Error ? err.message : String(err);
    out.dbError = message.slice(0, 240);
  }

  return NextResponse.json(out, { status: out.ok ? 200 : 503 });
}
