import { createWriteStream } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config";
import {
  contentTypeFor,
  type LocalFile,
  type ObjectStat,
  type ObjectStream,
  type PutOptions,
  type RangeSpec,
  type Storage,
} from "./types";

// S3-compatible storage (AWS S3, Cloudflare R2, MinIO). Set S3_ENDPOINT for R2/MinIO.

export class S3Storage implements Storage {
  readonly name = "s3";
  private client: S3Client;
  private bucket: string;

  constructor() {
    if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required when STORAGE_DRIVER=s3");
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT), // needed for MinIO/R2
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined, // fall back to the default credential chain (IAM role, etc.)
    });
  }

  async put(key: string, body: Readable, opts?: PutOptions): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts?.contentType ?? contentTypeFor(key),
        ...(opts?.contentDisposition
          ? { ContentDisposition: opts.contentDisposition }
          : {}),
      },
    });
    await upload.done();
  }

  async getUrl(key: string, opts?: { expiresSec?: number }): Promise<string> {
    if (env.S3_PUBLIC_BASE_URL) {
      return `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
    }
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: opts?.expiresSec ?? 3600 },
    );
  }

  async toLocalFile(key: string): Promise<LocalFile> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    const dir = await mkdtemp(join(tmpdir(), "captions-"));
    const path = join(dir, key.split("/").pop() || "object");
    await pipeline(res.Body as Readable, createWriteStream(path));
    return {
      path,
      cleanup: async () => {
        const { rm } = await import("node:fs/promises");
        await rm(dir, { recursive: true, force: true }).catch(() => {});
      },
    };
  }

  async getStream(key: string, range?: RangeSpec): Promise<ObjectStream> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    const totalSize = deriveTotalSize(res.ContentRange, res.ContentLength);
    return {
      stream: res.Body as Readable,
      contentType: res.ContentType ?? contentTypeFor(key),
      contentLength: res.ContentLength ?? 0,
      totalSize,
    };
  }

  async stat(key: string): Promise<ObjectStat | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { size: res.ContentLength ?? 0, contentType: res.ContentType };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await this.client
      .send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }))
      .catch(() => {});
  }
}

// "bytes 200-1000/67589" -> 67589
function deriveTotalSize(contentRange?: string, contentLength?: number): number {
  const m = contentRange?.match(/\/(\d+)$/);
  if (m) return Number(m[1]);
  return contentLength ?? 0;
}
