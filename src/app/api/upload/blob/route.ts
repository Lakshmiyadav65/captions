import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { config } from "@/lib/config";
import { requireUserId } from "@/lib/auth-helpers";
import { assertUploadRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Client-side upload token endpoint for Vercel Blob.
 * Bypasses the ~4.5MB serverless body limit so real videos can upload on Hobby.
 * Requires BLOB_READ_WRITE_TOKEN (create a Blob store in the Vercel project).
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "Direct video upload is not configured. Add a Vercel Blob store (free on Hobby) and set BLOB_READ_WRITE_TOKEN.",
        code: "blob_not_configured",
      },
      { status: 503 },
    );
  }

  const userId = await requireUserId();
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || undefined;
  const rate = await assertUploadRateLimit(userId, ip);
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many uploads. Try again shortly.", code: "rate_limit" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: [
          "video/mp4",
          "video/quicktime",
          "video/webm",
          "video/x-matroska",
          "video/x-msvideo",
          "application/octet-stream",
        ],
        maximumSizeInBytes: config.limits.maxUploadBytes,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ userId }),
      }),
      onUploadCompleted: async ({ blob }) => {
        log.info("blob.upload_completed", { url: blob.url, userId });
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload token failed";
    log.error("blob.handle_upload_failed", { err });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
