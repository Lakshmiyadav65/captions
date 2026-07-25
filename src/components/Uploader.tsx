"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { isQuotaError } from "@/lib/errors";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|wmv|flv)$/i;

export function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);

  const upload = (file: File) => {
    setError(null);
    setQuotaHit(false);
    if (!file.type.startsWith("video/") && !VIDEO_EXT.test(file.name)) {
      setError("Please choose a video file (MP4, MOV, MKV, WebM…).");
      return;
    }
    setUploading(true);
    setPct(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { id } = JSON.parse(xhr.responseText) as { id: string };
        router.push(`/jobs/${id}`);
      } else if (xhr.status === 401) {
        router.push("/signin");
      } else {
        let msg =
          xhr.responseText?.trim()
            ? "Upload failed. Please try again."
            : "Upload failed — the server crashed (often a missing Postgres DATABASE_URL on Vercel). Check /api/health.";
        let body: { error?: string; code?: string } = {};
        try {
          body = JSON.parse(xhr.responseText) as { error?: string; code?: string };
          msg = body.error ?? msg;
        } catch {
          /* keep default */
        }
        setQuotaHit(isQuotaError(xhr.status, body));
        setError(msg);
        setUploading(false);
      }
    };
    xhr.onerror = () => {
      setError("Upload failed. Please try again.");
      setUploading(false);
    };
    xhr.send(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
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
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
          dragging
            ? "border-sky-500 bg-sky-500/10"
            : "border-white/15 bg-neutral-900/60 hover:border-white/30"
        } ${uploading ? "pointer-events-none opacity-80" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />

        {uploading ? (
          <div className="w-full max-w-sm">
            <div className="mb-2 text-sm text-neutral-300">Uploading… {pct}%</div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/15 text-2xl">
              🎬
            </div>
            <p className="text-lg font-medium text-white">
              Drop a Telugu video here
            </p>
            <p className="mt-1 text-sm text-neutral-400">
              or click to browse · MP4, MOV, MKV, WebM
            </p>
          </>
        )}
      </div>

      {error && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            quotaHit
              ? "border border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "text-red-400"
          }`}
          role="alert"
        >
          {quotaHit && (
            <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-300/90">
              Limit reached
            </p>
          )}
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
