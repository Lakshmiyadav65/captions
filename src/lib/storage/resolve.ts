import { createWriteStream } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { getStorage, type LocalFile } from "./index";

/** True when videoKey is already a remote HTTPS object (e.g. Vercel Blob client upload). */
export function isRemoteVideoKey(key: string): boolean {
  return /^https?:\/\//i.test(key);
}

export async function resolveVideoUrl(key: string): Promise<string> {
  if (isRemoteVideoKey(key)) return key;
  return getStorage().getUrl(key);
}

/** Local path for ffmpeg / ASR — downloads remote URLs to a temp file. */
export async function resolveVideoLocal(key: string): Promise<LocalFile> {
  if (!isRemoteVideoKey(key)) {
    return getStorage().toLocalFile(key);
  }

  const res = await fetch(key);
  if (!res.ok || !res.body) {
    throw new Error(`Could not download uploaded video (${res.status}).`);
  }
  const dir = await mkdtemp(join(tmpdir(), "captions-remote-"));
  const path = join(dir, "source.mp4");
  const nodeStream = Readable.fromWeb(
    res.body as unknown as import("node:stream/web").ReadableStream,
  );
  await pipeline(nodeStream, createWriteStream(path));
  return {
    path,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
