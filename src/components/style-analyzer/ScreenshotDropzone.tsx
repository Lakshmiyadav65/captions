"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import type { AnalyzeResponse } from "@/lib/vision/types";

const IMG_EXT = /\.(png|jpe?g|webp)$/i;
const IMG_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

// Drops a caption screenshot and streams it to POST /api/analyze-style (raw body, like the
// video uploader). Owns upload progress; hands the phase transitions up to StyleAnalyzer.

export function ScreenshotDropzone({
  busy,
  onStart,
  onResult,
  onError,
}: {
  busy: boolean;
  onStart: () => void;
  onResult: (r: AnalyzeResponse) => void;
  onError: (msg: string, refusal: boolean) => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pct, setPct] = useState(0);

  const analyze = (file: File) => {
    if (!IMG_TYPES.has(file.type) && !IMG_EXT.test(file.name)) {
      onError("Please choose a PNG, JPEG, or WebP screenshot.", false);
      return;
    }
    onStart();
    setPct(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/analyze-style");
    xhr.setRequestHeader("Content-Type", file.type || "image/png");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onResult(JSON.parse(xhr.responseText) as AnalyzeResponse);
      } else if (xhr.status === 401) {
        router.push("/signin");
      } else {
        let msg = "Analysis failed. Please try again.";
        let refusal = false;
        try {
          const b = JSON.parse(xhr.responseText) as { error?: string; refusal?: boolean };
          msg = b.error ?? msg;
          refusal = Boolean(b.refusal);
        } catch {}
        onError(msg, refusal);
      }
    };
    xhr.onerror = () => onError("Analysis failed. Please try again.", false);
    xhr.send(file);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) analyze(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => !busy && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-16 text-center transition ${
        dragging
          ? "border-sky-500 bg-sky-500/10"
          : "border-white/15 bg-neutral-900/60 hover:border-white/30"
      } ${busy ? "pointer-events-none opacity-80" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) analyze(f);
        }}
      />

      {busy ? (
        <div className="w-full max-w-sm">
          <div className="mb-2 text-sm text-neutral-300">
            {pct < 100 ? `Uploading… ${pct}%` : "Analyzing the caption style…"}
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-all"
              style={{ width: `${pct < 100 ? pct : 100}%` }}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500/15 text-2xl">
            🎨
          </div>
          <p className="text-lg font-medium text-white">Drop a caption screenshot</p>
          <p className="mt-1 text-sm text-neutral-400">
            or click to browse · PNG, JPEG, WebP · a Reel/Short frame with subtitles
          </p>
        </>
      )}
    </div>
  );
}
