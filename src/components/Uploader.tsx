"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { upload as blobUpload } from "@vercel/blob/client";

const VIDEO_EXT = /\.(mp4|mov|mkv|webm|avi|m4v|mpg|mpeg|wmv|flv)$/i;
/** Vercel Functions reject bodies over ~4.5MB — use Blob direct upload above this. */
const VERCEL_BODY_LIMIT = 4.2 * 1024 * 1024;

function isLocalHost(): boolean {
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}

function isBlobUnavailable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /blob_not_configured|not configured|BLOB|client token|Failed to retrieve/i.test(
    msg,
  );
}

function isAuthRequiredError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /client token|Failed to retrieve|Sign in to upload|unauthorized|401/i.test(msg);
}

const SIGN_IN_UPLOAD = `/signin?next=${encodeURIComponent("/?start=1")}`;

type UploaderProps = {
  /** Dark for the app shell; light for the marketing landing hero. */
  tone?: "dark" | "light";
  /** When false (auth on, logged out), send users to sign-in instead of uploading. */
  canUpload?: boolean;
  /** Landing dropzone styled by landing.css (`.lp-uploader`). */
  variant?: "default" | "landing";
};

export function Uploader({ tone = "dark", canUpload = true, variant = "default" }: UploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pct, setPct] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const light = tone === "light";

  const finishWithJobId = (id: string) => {
    router.push(`/jobs/${id}`);
  };

  const requireSignIn = () => {
    setError("Sign in with Google to upload a video.");
    router.push(SIGN_IN_UPLOAD);
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
      requireSignIn();
      return;
    }
    if (!res.ok || !data.id) {
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
          requireSignIn();
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
        reject(new Error(msg));
      };
      xhr.onerror = () => {
        reject(new Error("Upload failed. Please try again."));
      };
      xhr.send(file);
    });

  const upload = async (file: File) => {
    setError(null);
    if (!canUpload) {
      requireSignIn();
      return;
    }
    if (!file.type.startsWith("video/") && !VIDEO_EXT.test(file.name)) {
      setError("Please choose a video file (MP4, MOV, MKV, WebM…).");
      return;
    }
    setUploading(true);
    setPct(0);

    try {
      // Local next dev uses disk storage — Blob token is only on Vercel.
      if (isLocalHost()) {
        await uploadViaApi(file);
        return;
      }

      try {
        await uploadViaBlob(file);
      } catch (blobErr) {
        if (isAuthRequiredError(blobErr)) {
          requireSignIn();
          setUploading(false);
          return;
        }
        // Fall back to classic API when Blob isn't configured (or for smaller files).
        if (file.size <= VERCEL_BODY_LIMIT || isBlobUnavailable(blobErr)) {
          try {
            await uploadViaApi(file);
            return;
          } catch (apiErr) {
            if (isAuthRequiredError(apiErr)) {
              requireSignIn();
              setUploading(false);
              return;
            }
            if (file.size > VERCEL_BODY_LIMIT) throw blobErr;
            throw apiErr;
          }
        }
        throw blobErr;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
      setError(
        /Failed to retrieve the client token/i.test(msg)
          ? "Sign in with Google to upload a video."
          : msg,
      );
      setUploading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!canUpload) {
      requireSignIn();
      return;
    }
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  };

  if (variant === "landing") {
    return (
      <div className="lp-uploader">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => {
            if (uploading) return;
            if (!canUpload) {
              requireSignIn();
              return;
            }
            inputRef.current?.click();
          }}
          className={[
            "lp-uploader-drop",
            dragging ? "is-dragging" : "",
            uploading ? "is-uploading" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="lp-uploader-icons" aria-hidden>
            <div className="lp-uploader-stack" />
            <div className="lp-uploader-plus">+</div>
          </div>
          {uploading ? (
            <>
              <span className="lp-uploader-title">Uploading… {pct}%</span>
              <div className="lp-uploader-bar">
                <div style={{ width: `${pct}%` }} />
              </div>
            </>
          ) : !canUpload ? (
            <>
              <span className="lp-uploader-title">Sign in to upload</span>
              <span className="lp-uploader-sub">Free Google sign-in · then drop your video</span>
            </>
          ) : (
            <span className="lp-uploader-title">Drop your video</span>
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
        {error ? <p className="lp-uploader-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => {
          if (uploading) return;
          if (!canUpload) {
            requireSignIn();
            return;
          }
          inputRef.current?.click();
        }}
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition sm:py-16",
          light
            ? dragging
              ? "border-sky-400 bg-sky-50"
              : "border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-white"
            : dragging
              ? "border-sky-400 bg-sky-400/10"
              : "border-neutral-700 bg-neutral-900/50 hover:border-neutral-500",
          uploading ? "pointer-events-none opacity-70" : "",
        ].join(" ")}
      >
        <div
          className={[
            "mb-3 flex h-12 w-12 items-center justify-center rounded-full text-xl",
            light ? "bg-slate-900 text-white" : "",
          ].join(" ")}
          aria-hidden
        >
          {light ? (
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          ) : (
            "🎬"
          )}
        </div>
        {uploading ? (
          <>
            <p className={["text-lg font-medium", light ? "text-slate-900" : "text-neutral-100"].join(" ")}>
              Uploading… {pct}%
            </p>
            <div
              className={[
                "mt-4 h-1.5 w-48 overflow-hidden rounded-full",
                light ? "bg-slate-200" : "bg-neutral-800",
              ].join(" ")}
            >
              <div
                className="h-full rounded-full bg-sky-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        ) : !canUpload ? (
          <>
            <p className={["text-lg font-medium", light ? "text-slate-900" : "text-neutral-100"].join(" ")}>
              Sign in to upload
            </p>
            <p className={["mt-1 text-sm", light ? "text-slate-500" : "text-neutral-400"].join(" ")}>
              Free Google sign-in · then drop your Telugu Reel or Short
            </p>
          </>
        ) : (
          <>
            <p className={["text-lg font-medium", light ? "text-slate-900" : "text-neutral-100"].join(" ")}>
              {light ? "Drop your video to start" : "Drop a Telugu video here"}
            </p>
            <p className={["mt-1 text-sm", light ? "text-slate-500" : "text-neutral-400"].join(" ")}>
              {light
                ? "Click to browse · MP4, MOV, MKV, WebM"
                : "or click to browse · MP4, MOV, MKV, WebM"}
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
        <div className={["mt-3 text-sm", light ? "text-red-600" : "text-red-400"].join(" ")}>
          <p>{error}</p>
        </div>
      )}
    </div>
  );
}
