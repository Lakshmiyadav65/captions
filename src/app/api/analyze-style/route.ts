import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { assertWithinAnalysisQuota } from "@/lib/quota";
import { getStorage } from "@/lib/storage";
import {
  getVisionProvider,
  profileToSubtitleStyle,
  clampConfidence,
  bestMatch,
  type AnalyzeResponse,
  type StyleProfile,
  type StyleProfileInput,
} from "@/lib/vision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A vision call re-encodes + round-trips an image; allow a generous ceiling on a container host.
export const maxDuration = 120;

// POST /api/analyze-style — the client streams a screenshot as the request body; we store it,
// extract a normalized StyleProfile via the vision provider, derive the render-ready
// SubtitleStyle, suggest a similar saved style, and log the analysis (also the quota ledger).

type MediaType = StyleProfileInput["mediaType"];
const EXT: Record<MediaType, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function mediaTypeOf(contentType: string): MediaType | null {
  const ct = contentType.split(";")[0].trim().toLowerCase();
  return ct === "image/png" || ct === "image/jpeg" || ct === "image/webp" ? ct : null;
}

export async function POST(req: NextRequest) {
  if (!req.body) {
    return NextResponse.json({ error: "No image in request body." }, { status: 400 });
  }

  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to analyze a style." }, { status: 401 });
  }

  const mediaType = mediaTypeOf(req.headers.get("content-type") || "");
  if (!mediaType) {
    return NextResponse.json(
      { error: "Please upload a PNG, JPEG, or WebP screenshot." },
      { status: 415 },
    );
  }

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared && declared > config.limits.maxImageBytes) {
    return NextResponse.json(
      { error: `Image too large. Max ${config.limits.maxImageMB} MB.` },
      { status: 413 },
    );
  }

  const quota = await assertWithinAnalysisQuota(userId);
  if (!quota.ok) {
    return NextResponse.json(
      { error: quota.reason, code: quota.code },
      { status: 429 },
    );
  }

  const imageKey = `styles/${randomUUID()}/source${EXT[mediaType]}`;
  const storage = getStorage();

  try {
    const nodeStream = Readable.fromWeb(req.body as unknown as NodeWebReadableStream);
    await storage.put(imageKey, nodeStream, { contentType: mediaType });

    const localImage = await storage.toLocalFile(imageKey);
    let profile: StyleProfile;
    let ocrText: string | null = null;
    try {
      const provider = getVisionProvider();
      profile = await provider.analyzeStyle({ imagePath: localImage.path, mediaType });
      // OCR is a separate, off-by-default second call (config.limits.ocrEnabled). Its text is
      // for the user's reference only and never feeds style extraction or caption generation.
      if (config.limits.ocrEnabled && provider.ocr) {
        ocrText = await provider
          .ocr({ imagePath: localImage.path, mediaType })
          .then((r) => r.text || null)
          .catch(() => null);
      }
    } finally {
      await localImage.cleanup().catch(() => {});
    }
    profile.confidence = clampConfidence(profile.confidence);

    const subtitleStyle = profileToSubtitleStyle(profile);

    const saved = await prisma.savedStyle.findMany({
      where: { userId },
      select: { id: true, name: true, profile: true },
    });
    const match = bestMatch(
      profile,
      saved.map((s) => ({ id: s.id, name: s.name, profile: JSON.parse(s.profile) as StyleProfile })),
      config.limits.styleMatchThreshold,
    );

    const row = await prisma.styleAnalysis.create({
      data: {
        userId,
        imageKey,
        provider: profile.provider,
        profile: JSON.stringify(profile),
        subtitleStyle: JSON.stringify(subtitleStyle),
        ocrText,
        confidence: profile.confidence,
      },
    });

    const body: AnalyzeResponse = {
      analysisId: row.id,
      sourceImageKey: imageKey,
      imageUrl: await storage.getUrl(imageKey),
      profile,
      subtitleStyle,
      ocrText,
      match,
    };
    return NextResponse.json(body);
  } catch (err) {
    // No ledger row was written, so a failed/declined analysis never burns quota.
    await storage.delete(imageKey).catch(() => {});
    const message = err instanceof Error ? err.message : "Style analysis failed";
    if (message.startsWith("REFUSAL:")) {
      return NextResponse.json({ error: message.slice(8).trim(), refusal: true }, { status: 422 });
    }
    return NextResponse.json({ error: message.slice(0, 500) }, { status: 500 });
  }
}
