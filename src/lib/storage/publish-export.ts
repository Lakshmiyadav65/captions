import { createReadStream } from "node:fs";
import { getStorage } from "@/lib/storage";
import { config } from "@/lib/config";

/**
 * Persist a burned MP4 and return a browser-downloadable URL.
 *
 * On Vercel with STORAGE_DRIVER=local, writing only to /tmp is ephemeral: the
 * follow-up GET often hits another instance and 404s. Prefer Vercel Blob (same
 * token used for uploads) or S3 when available.
 */
export async function publishExportMp4(
  key: string,
  filePath: string,
): Promise<{ url: string; key: string }> {
  if (config.usesS3) {
    const storage = getStorage();
    await storage.put(key, createReadStream(filePath), {
      contentType: "video/mp4",
    });
    return { url: await storage.getUrl(key), key };
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, createReadStream(filePath), {
      access: "public",
      contentType: "video/mp4",
      addRandomSuffix: true,
      multipart: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    // Use the plain CDN URL (not ?download=1). The client fetches bytes and
    // triggers a same-origin blob: download — more reliable in Chrome.
    return { url: blob.url, key: blob.pathname };
  }

  if (process.env.VERCEL) {
    throw new Error(
      "Burned MP4 download needs Vercel Blob (or S3). In the Vercel project: Storage → Blob → Connect, then redeploy.",
    );
  }

  const storage = getStorage();
  await storage.put(key, createReadStream(filePath), {
    contentType: "video/mp4",
  });
  return { url: await storage.getUrl(key), key };
}
