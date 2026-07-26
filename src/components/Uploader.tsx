"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { upload as blobUpload } from "@vercel/blob/client";
import { isQuotaError } from "@/lib/errors";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|wmv|flv)$/i;
/** Vercel Functions reject bodies over ~4.5MB — use Blob direct upload above this. */
const VERCEL_BODY_LIMIT = 4.2 * 1024 * 1024;

export function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);

  const finishWithJobId = (id: string) => {
    router.push(`/jobs/${id}`);
  };

  const uploadViaBlob = async (file: File) => {
    const blob = await blobUpload(file.name, file, {
      access: "public",
      handleUploadUrl: "/api/upload/blob",
      multipart: true,
      onUploadProgress: ({ percentage }) => {
        setPct(Math.min(99, Math.round(percentage)));
      },
    });
    const res = await fetch("/api/upload/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: blob.url, filename: file.name }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      error?: string;
      code?: string;
    };
    if (res.status === 401) {
      router.push("/signin");
      return;
    }
    if (!res.ok || !data.id) {
      setQuotaHit(isQuotaError(res.status, data));
      throw new Error(data.error ?? "Upload failed. Please try again.");
    }
    setPct(100);
    finishWithJobId(data.id);
  };

  const uploadViaApi = (file: File) =>
    new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");
      xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const { id } = JSON.parse(xhr.responseText) as { id: string };
            finishWithJobId(id);
            resolve();
          } catch (err) {
            reject(err);
          }
          return;
        }
        if (xhr.status === 401) {
          router.push("/signin");
          resolve();
          return;
        }
        if (xhr.status === 413) {
          reject(
            new Error(
              "This video is too large for the free Vercel upload path (~4.5 MB). Compress it, or we need Vercel Blob enabled for larger files.",
            ),
          );
          return;
        }
        let msg = "Upload failed. Please try again.";
        let body: { error?: string; code?: string } = {};
        try {
          body = JSON.parse(xhr.responseText) as { error?: string; code?: string };
          msg = body.error ?? msg;
        } catch {
          if (!xhr.responseText?.trim()) {
            msg =
              "Upload failed — the file may exceed Vercel’s 4.5 MB limit. Try a shorter/compressed clip.";
          }
        }
        setQuotaHit(isQuotaError(xhr.status, body));
        reject(new Error(msg));
      };
      xhr.onerror = () => {
        reject(new Error("Upload failed. Please try again."));
      };
      xhr.send(file);
    });

  const upload = async (file: File) => {
    setError(null);
    setQuotaHit(false);
    if (!file.type.startsWith("video/") && !VIDEO_EXT.test(file.name)) {
      setError("Please choose a video file (MP4, MOV, MKV, WebM…).");
      return;
    }
    setUploading(true);
    setPct(0);

    try {
      // Prefer Blob for anything near/over the serverless body limit.
      if (file.size > VERCEL_BODY_LIMIT) {
        await uploadViaBlob(file);
      } else {
        try {
          await uploadViaBlob(file);
        } catch (blobErr) {
          const msg = blobErr instanceof Error ? blobErr.message : "";
          if (/blob_not_configured|not configured|BLOB/i.test(msg)) {
            await uploadViaApi(file);
          } else {
            // Small file: fall back to classic API if Blob token missing mid-flow
            try {
              await uploadViaApi(file);
            } catch {
              throw blobErr;
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition",
          dragging
            ? "border-sky-400 bg-sky-400/10"
            : "border-neutral-700 bg-neutral-900/50 hover:border-neutral-500",
          uploading ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
      >
        <div className="mb-3 text-4xl" aria-hidden>
          🎬
        </div>
        {uploading ? (
          <>
            <p className="text-lg font-medium text-neutral-100">Uploading… {pct}%</p>
            <div className="mt-4 h-1.5 w-48 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-medium text-neutral-100">Drop a Telugu video here</p>
            <p className="mt-1 text-sm text-neutral-400">
              or click to browse · MP4, MOV, MKV, WebM
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="video/*,.mp4,.mov,.mkv,.webm,.avi,.m4v"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <div className="mt-3 space-y-2 text-sm text-red-400">
          <p>{error}</p>
          {quotaHit && (
            <a href="/billing" className="text-sky-400 underline">
              View usage / plans
            </a>
          )}
        </div>
      )}
    </div>
  );
}
