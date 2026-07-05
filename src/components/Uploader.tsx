"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|wmv|flv)$/i;

export function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = (file: File) => {
    setError(null);
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
        let msg = "Upload failed. Please try again.";
        try {
          msg = (JSON.parse(xhr.responseText) as { error?: string }).error ?? msg;
        } catch {}
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

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </div>
  );
}
