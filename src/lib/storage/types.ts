import type { Readable } from "node:stream";

// Storage abstraction so uploads/audio live behind one interface. Local disk for dev,
// S3-compatible (AWS S3 / Cloudflare R2 / MinIO) for production — chosen by STORAGE_DRIVER.

export interface PutOptions {
  contentType?: string;
  contentLength?: number;
  contentDisposition?: string;
}

export interface RangeSpec {
  start: number;
  end: number;
}

export interface ObjectStat {
  size: number;
  contentType?: string;
}

export interface LocalFile {
  path: string;
  cleanup: () => Promise<void>;
}

export interface ObjectStream {
  stream: Readable;
  contentType?: string;
  contentLength: number;
  totalSize: number;
}

export interface Storage {
  readonly name: string;
  /** Store an object from a readable stream (no full-buffering of large videos). */
  put(key: string, body: Readable, opts?: PutOptions): Promise<void>;
  /** A URL the browser can GET: our media route (local) or a presigned/public URL (s3). */
  getUrl(key: string, opts?: { expiresSec?: number }): Promise<string>;
  /** A local filesystem path for the object — downloads from remote to a temp file if needed. */
  toLocalFile(key: string): Promise<LocalFile>;
  /** Stream the object back, optionally a byte range (for video seeking). */
  getStream(key: string, range?: RangeSpec): Promise<ObjectStream>;
  stat(key: string): Promise<ObjectStat | null>;
  delete(key: string): Promise<void>;
}

const TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/x-m4v",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wav: "audio/wav",
  flac: "audio/flac",
};

export function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return TYPES[ext] ?? "application/octet-stream";
}
