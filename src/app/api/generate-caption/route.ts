import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { assertWithinGenerationQuota } from "@/lib/quota";
import { getCaptionProvider } from "@/lib/caption";
import { romanizeTelugu } from "@/lib/transliterate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/generate-caption — generate ONE short, original Telugu caption from the user's
// prompt + the analyzed style's vibe (tone only). Output respects OUTPUT_MODE (romanized when
// translit). Metered by the monthly generation quota; the ledger row is written only on success.

interface Body {
  prompt?: string;
  vibe?: string;
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to generate captions." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "Enter a prompt or idea." }, { status: 400 });
  }

  const quota = await assertWithinGenerationQuota(userId);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.reason, code: quota.code },
      { status: 429 },
    );
  }

  try {
    const result = await getCaptionProvider().generate({ prompt, vibe: body.vibe });
    const text =
      config.outputMode === "translit" ? romanizeTelugu(result.text) : result.text;

    await prisma.generationLog.create({ data: { userId } });
    return NextResponse.json({ text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Caption generation failed";
    if (message.startsWith("REFUSAL:")) {
      return NextResponse.json({ error: message.slice(8).trim(), refusal: true }, { status: 422 });
    }
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  }
}
