import { requireUserId } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { contentDispositionAttachment } from "@/lib/export-filename";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Same-origin MP4 download. Chrome ignores the `download` attribute on
 * cross-origin Blob/CDN URLs and navigates instead — this keeps the file
 * on tcaptions.vercel.app with Content-Disposition: attachment.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const userId = await requireUserId();
  if (userId === null) {
    return new Response("Sign in to download.", { status: 401 });
  }

  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      userId: true,
      exportStatus: true,
      exportFilename: true,
      exportUrl: true,
      exportKey: true,
    },
  });
  if (!job || job.userId !== userId) {
    return new Response("Not found", { status: 404 });
  }
  if (job.exportStatus !== "completed") {
    return new Response("Export is not ready yet.", { status: 409 });
  }

  const filename = job.exportFilename || "captioned.mp4";
  const headers: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Content-Disposition": contentDispositionAttachment(filename),
    "Cache-Control": "private, no-store",
  };

  let sourceUrl = job.exportUrl;
  if (!sourceUrl && job.exportKey) {
    try {
      sourceUrl = await getStorage().getUrl(job.exportKey);
    } catch {
      sourceUrl = null;
    }
  }
  if (!sourceUrl) {
    return new Response("Export file is missing.", { status: 404 });
  }

  const abs = sourceUrl.startsWith("http")
    ? sourceUrl
    : new URL(sourceUrl, req.url).toString();

  const upstream = await fetch(abs);
  if (!upstream.ok || !upstream.body) {
    return new Response("Could not read the exported video.", { status: 502 });
  }

  const length = upstream.headers.get("content-length");
  if (length) headers["Content-Length"] = length;

  return new Response(upstream.body, { status: 200, headers });
}
