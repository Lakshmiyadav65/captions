import { Readable } from "node:stream";
import { config } from "@/lib/config";
import { prisma } from "@/lib/db";
import { getStorage } from "@/lib/storage";
import { contentDispositionAttachment } from "@/lib/export-filename";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves stored media. For S3 it redirects the browser to a presigned URL (offloads
// bandwidth); for local disk it streams from ./storage with HTTP range support so the
// <video> element can seek. Replaces serving user uploads out of /public.

async function exportDisposition(key: string): Promise<Record<string, string>> {
  if (!key.startsWith("exports/")) return {};
  const jobId = key.split("/")[1];
  let filename = key.split("/").pop() ?? "captioned.mp4";
  if (jobId) {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { exportFilename: true },
    });
    if (job?.exportFilename) filename = job.exportFilename;
  }
  return {
    "Content-Disposition": contentDispositionAttachment(filename),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: parts } = await params;
  const key = parts.map(decodeURIComponent).join("/");
  const storage = getStorage();

  if (config.usesS3) {
    const url = await storage.getUrl(key);
    return Response.redirect(url, 302);
  }

  const stat = await storage.stat(key);
  if (!stat) return new Response("Not found", { status: 404 });

  const disposition = await exportDisposition(key);
  const range = req.headers.get("range");
  if (range) {
    const m = /bytes=(\d+)-(\d*)/.exec(range);
    const start = m ? parseInt(m[1], 10) : 0;
    const end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    const obj = await storage.getStream(key, { start, end });
    return new Response(Readable.toWeb(obj.stream) as unknown as ReadableStream, {
      status: 206,
      headers: {
        "Content-Type": obj.contentType ?? "application/octet-stream",
        "Content-Length": String(obj.contentLength),
        "Content-Range": `bytes ${start}-${end}/${obj.totalSize}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
        ...disposition,
      },
    });
  }

  const obj = await storage.getStream(key);
  return new Response(Readable.toWeb(obj.stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": obj.contentType ?? "application/octet-stream",
      "Content-Length": String(obj.contentLength),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, max-age=3600",
      ...disposition,
    },
  });
}
