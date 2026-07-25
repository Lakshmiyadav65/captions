import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";
import { DEFAULT_STYLE, type SubtitleStyle } from "@/lib/subtitles/style";
import type { SavedStyleDTO, StyleProfile } from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET  /api/styles      — list the current user's saved styles ("My Styles")
// POST /api/styles      — save a style, either from an inline profile+style or a prior analysis

export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to view your styles." }, { status: 401 });
  }

  const storage = getStorage();
  const rows = await prisma.savedStyle.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const styles: SavedStyleDTO[] = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      name: r.name,
      confidence: r.confidence,
      createdAt: r.createdAt.toISOString(),
      profile: JSON.parse(r.profile) as StyleProfile,
      subtitleStyle: JSON.parse(r.subtitleStyle) as SubtitleStyle,
      imageUrl: r.sourceImageKey ? await storage.getUrl(r.sourceImageKey) : null,
    })),
  );
  return NextResponse.json({ styles });
}

interface SaveBody {
  name?: string;
  // Save from a prior analysis (reuses its quota'd result + stored image)…
  analysisId?: string;
  // …or save an inline (possibly hand-tweaked) profile + style.
  profile?: StyleProfile;
  subtitleStyle?: SubtitleStyle;
  sourceImageKey?: string;
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to save a style." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as SaveBody;
  const name = (body.name ?? "").trim() || "Untitled style";

  let profile: StyleProfile;
  let subtitleStyle: SubtitleStyle;
  let sourceImageKey: string | null = null;

  if (body.analysisId) {
    const a = await prisma.styleAnalysis.findUnique({ where: { id: body.analysisId } });
    if (!a || a.userId !== userId) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }
    profile = JSON.parse(a.profile) as StyleProfile;
    subtitleStyle = JSON.parse(a.subtitleStyle) as SubtitleStyle;
    sourceImageKey = a.imageKey;
  } else if (body.profile && body.subtitleStyle) {
    profile = body.profile;
    // Persist a full style so hand-tweaks and future field additions round-trip cleanly.
    subtitleStyle = { ...DEFAULT_STYLE, ...body.subtitleStyle };
    sourceImageKey = body.sourceImageKey ?? null;
  } else {
    return NextResponse.json(
      { error: "Provide analysisId, or profile + subtitleStyle." },
      { status: 400 },
    );
  }

  const row = await prisma.savedStyle.create({
    data: {
      userId,
      name,
      profile: JSON.stringify(profile),
      subtitleStyle: JSON.stringify(subtitleStyle),
      sourceImageKey,
      confidence: profile.confidence,
    },
  });
  return NextResponse.json({ id: row.id });
}
