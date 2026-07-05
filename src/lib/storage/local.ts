import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, rm, stat as fsStat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  contentTypeFor,
  type LocalFile,
  type ObjectStat,
  type ObjectStream,
  type PutOptions,
  type RangeSpec,
  type Storage,
} from "./types";

// Local-disk storage under ./storage (git-ignored, NOT public). Objects are served via
// the /api/media route with HTTP range support, so playback doesn't depend on /public.

const ROOT = process.env.STORAGE_LOCAL_DIR
  ? resolve(process.env.STORAGE_LOCAL_DIR)
  : join(process.cwd(), "storage");

function keyToPath(key: string): string {
  const target = resolve(ROOT, key);
  // Prevent path traversal outside ROOT.
  if (target !== ROOT && !target.startsWith(ROOT + sep)) {
    throw new Error("Invalid storage key");
  }
  return target;
}

export class LocalStorage implements Storage {
  readonly name = "local";

  async put(key: string, body: Readable, _opts?: PutOptions): Promise<void> {
    const p = keyToPath(key);
    await mkdir(dirname(p), { recursive: true });
    await pipeline(body, createWriteStream(p));
  }

  async getUrl(key: string): Promise<string> {
    const encoded = key.split("/").map(encodeURIComponent).join("/");
    return `/api/media/${encoded}`;
  }

  async toLocalFile(key: string): Promise<LocalFile> {
    return { path: keyToPath(key), cleanup: async () => {} };
  }

  async getStream(key: string, range?: RangeSpec): Promise<ObjectStream> {
    const p = keyToPath(key);
    const st = await fsStat(p);
    const contentType = contentTypeFor(key);
    if (range) {
      return {
        stream: createReadStream(p, { start: range.start, end: range.end }),
        contentLength: range.end - range.start + 1,
        totalSize: st.size,
        contentType,
      };
    }
    return {
      stream: createReadStream(p),
      contentLength: st.size,
      totalSize: st.size,
      contentType,
    };
  }

  async stat(key: string): Promise<ObjectStat | null> {
    try {
      const st = await fsStat(keyToPath(key));
      return { size: st.size, contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(keyToPath(key), { force: true }).catch(() => {});
  }
}
