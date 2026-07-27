import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { requireUserId } from "@/lib/auth-helpers";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
  "video/x-msvideo",
]);

const EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
  "video/x-matroska": ".mkv",
  "video/x-msvideo": ".avi",
};

function normalizeMime(raw: string): string {
  return raw.split(";")[0].trim().toLowerCase();
}

function extFor(mime: string, filename: string): string {
  if (EXT[mime]) return EXT[mime];
  const fromName = filename.includes(".") ? `.${filename.split(".").pop()!.toLowerCase()}` : "";
  return fromName || ".bin";
}

// GET /api/style-request — list the current user's style requests
export async function GET() {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to view style requests." }, { status: 401 });
  }

  const rows = await prisma.styleRequest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      title: r.title,
      platform: r.platform,
      notes: r.notes,
      status: r.status,
      referenceName: r.referenceName,
      referenceType: r.referenceType,
      hasReference: Boolean(r.referenceKey || r.referenceUrl),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

// POST /api/style-request — multipart form (preferred) or JSON with a Blob URL
export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to request a custom style." }, { status: 401 });
  }

  const contentType = req.headers.get("content-type") || "";
  let title = "";
  let platform = "";
  let notes = "";
  let referenceUrl: string | null = null;
  let referenceName: string | null = null;
  let referenceType: string | null = null;
  let referenceKey: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    title = String(form.get("title") ?? "").trim();
    platform = String(form.get("platform") ?? "").trim();
    notes = String(form.get("notes") ?? "").trim();
    const raw = form.get("file");
    file = raw instanceof File && raw.size > 0 ? raw : null;
  } else {
    const body = (await req.json().catch(() => ({}))) as {
      title?: string;
      platform?: string;
      notes?: string;
      referenceUrl?: string;
      filename?: string;
      contentType?: string;
    };
    title = String(body.title ?? "").trim();
    platform = String(body.platform ?? "").trim();
    notes = String(body.notes ?? "").trim();
    referenceUrl = body.referenceUrl?.trim() || null;
    referenceName = body.filename?.trim() || null;
    referenceType = body.contentType ? normalizeMime(body.contentType) : null;
  }

  if (!title || title.length < 2) {
    return NextResponse.json(
      { error: "Give this style a short name (e.g. “Yellow kinetic pop”)." },
      { status: 400 },
    );
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "Title is too long (max 120 characters)." }, { status: 400 });
  }
  if (platform.length > 80) {
    return NextResponse.json({ error: "Platform is too long." }, { status: 400 });
  }
  if (notes.length > 2000) {
    return NextResponse.json({ error: "Notes are too long (max 2000 characters)." }, { status: 400 });
  }

  if (file) {
    const mime = normalizeMime(file.type || "application/octet-stream");
    const isImage = IMAGE_TYPES.has(mime);
    const isVideo = VIDEO_TYPES.has(mime);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "Upload a screenshot (PNG/JPEG/WebP) or a short video (MP4/MOV/WebM)." },
        { status: 415 },
      );
    }
    const maxBytes = isImage ? config.limits.maxImageBytes : Math.min(config.limits.maxUploadBytes, 40 * 1024 * 1024);
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: isImage
            ? `Screenshot too large. Max ${config.limits.maxImageMB} MB.`
            : "Reference video too large for this form. Trim to a short clip or upload a clear screenshot.",
        },
        { status: 413 },
      );
    }

    referenceName = file.name || (isImage ? "screenshot" : "reference");
    referenceType = mime;
    referenceKey = `style-requests/${randomUUID()}/source${extFor(mime, referenceName)}`;
    const storage = getStorage();
    const buf = Buffer.from(await file.arrayBuffer());
    await storage.put(referenceKey, Readable.from(buf), {
      contentType: mime,
      contentLength: buf.length,
    });
  } else if (referenceUrl) {
    if (!/^https:\/\//i.test(referenceUrl)) {
      return NextResponse.json({ error: "Invalid reference URL." }, { status: 400 });
    }
  } else {
    return NextResponse.json(
      {
        error:
          "Add a reference screenshot or short video of the caption style you want. A video gives the best result.",
      },
      { status: 400 },
    );
  }

  const openCount = await prisma.styleRequest.count({
    where: { userId, status: { in: ["open", "in_progress"] } },
  });
  if (openCount >= 5) {
    return NextResponse.json(
      {
        error: "You already have several open style requests. We’ll finish those first — usually within 24 hours.",
        code: "too_many_open",
      },
      { status: 429 },
    );
  }

  const row = await prisma.styleRequest.create({
    data: {
      userId,
      title,
      platform: platform || null,
      notes: notes || null,
      referenceKey,
      referenceName,
      referenceType,
      referenceUrl,
      status: "open",
    },
  });

  return NextResponse.json({
    id: row.id,
    status: row.status,
    message: "Request received. We’ll add this look to your presets within about 24 hours.",
  });
}
