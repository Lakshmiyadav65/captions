"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const IMAGE_OK = /\.(png|jpe?g|webp)$/i;
const VIDEO_OK = /\.(mp4|mov|webm|mkv|m4v)$/i;

type RequestRow = {
  id: string;
  title: string;
  platform: string | null;
  notes: string | null;
  status: string;
  referenceName: string | null;
  hasReference: boolean;
  createdAt: string;
};

function statusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Queued";
    case "in_progress":
      return "Building";
    case "done":
      return "In your presets";
    case "declined":
      return "Couldn’t match";
    default:
      return status;
  }
}

export function StyleRequestForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadRequests = async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/style-request");
      if (res.status === 401) {
        router.push(`/signin?next=${encodeURIComponent("/style-request")}`);
        return;
      }
      const data = (await res.json()) as { requests?: RequestRow[] };
      setRequests(data.requests ?? []);
    } catch {
      // list is secondary — form still works
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFile = (next: File | null) => {
    setError(null);
    setSuccess(null);
    if (!next) {
      setFile(null);
      return;
    }
    const ok =
      IMAGE_OK.test(next.name) ||
      VIDEO_OK.test(next.name) ||
      next.type.startsWith("image/") ||
      next.type.startsWith("video/");
    if (!ok) {
      setError("Use a screenshot (PNG/JPEG/WebP) or a short reference video (MP4/MOV/WebM).");
      setFile(null);
      return;
    }
    setFile(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim()) {
      setError("Give this style a short name.");
      return;
    }
    if (!file) {
      setError("Upload a reference screenshot or short video of the style you want.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("platform", platform.trim());
      form.set("notes", notes.trim());
      form.set("file", file);

      const res = await fetch("/api/style-request", { method: "POST", body: form });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };

      if (res.status === 401) {
        router.push(`/signin?next=${encodeURIComponent("/style-request")}`);
        return;
      }
      if (!res.ok) {
        throw new Error(data.error ?? "Could not submit your request.");
      }

      setSuccess(data.message ?? "Request received. We’ll add this look within about 24 hours.");
      setTitle("");
      setPlatform("");
      setNotes("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await loadRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sr-layout">
      <form onSubmit={onSubmit} className="sr-form-card">
        <div className="sr-field">
          <label htmlFor="style-title">Style name</label>
          <input
            id="style-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Yellow kinetic pop like @creator"
            maxLength={120}
            required
          />
        </div>

        <div className="sr-field">
          <label htmlFor="style-platform">Where did you see it?</label>
          <input
            id="style-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="Instagram Reels, YouTube Shorts, …"
            maxLength={80}
          />
        </div>

        <div className="sr-field">
          <label htmlFor="style-notes">Details (optional)</label>
          <textarea
            id="style-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Colors, font feel, word pop / karaoke, outline, position — anything that helps us match it."
            rows={4}
            maxLength={2000}
          />
        </div>

        <div className="sr-field">
          <label>
            Reference media <span className="sr-optional">(video preferred)</span>
          </label>
          <p className="sr-hint">
            Drop a short clip of the caption style, or a clear screenshot. We’ll recreate it and
            add it to your presets within about 24 hours.
          </p>
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`sr-dropzone ${dragging ? "is-dragging" : ""}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.mkv,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className="sr-drop-title">
              {file ? file.name : "Drop screenshot or reference video"}
            </span>
            <span className="sr-drop-meta">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · click to change`
                : "PNG, JPEG, WebP · MP4, MOV, WebM"}
            </span>
          </div>
        </div>

        {error ? <p className="sr-alert sr-alert-error">{error}</p> : null}
        {success ? <p className="sr-alert sr-alert-ok">{success}</p> : null}

        <button type="submit" disabled={submitting} className="btn-primary sr-submit">
          {submitting ? "Sending…" : "Request this style"}
        </button>
      </form>

      <aside className="sr-aside">
        <div className="sr-info-card">
          <span className="style-request-badge">Beta</span>
          <h2>How it works</h2>
          <ol>
            <li>
              <strong>1. Sign in</strong>
              <span>Only signed-in creators can submit a request.</span>
            </li>
            <li>
              <strong>2. Upload a reference</strong>
              <span>A short clip of the look works best; screenshots work too.</span>
            </li>
            <li>
              <strong>3. Find it in presets</strong>
              <span>We deliver to My Styles within about 24 hours.</span>
            </li>
          </ol>
          <p className="sr-aside-note">
            Prefer the instant{" "}
            <Link href="/style-analyzer">Style Analyzer</Link> if a single screenshot is enough —
            use this form when you need a handcrafted match.
          </p>
        </div>

        <div className="sr-requests-card">
          <div className="sr-requests-head">
            <h2>Your requests</h2>
            <Link href="/styles">My Styles →</Link>
          </div>
          {loadingList ? (
            <p className="sr-empty">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="sr-empty">No requests yet. Submit your first look above.</p>
          ) : (
            <ul className="sr-request-list">
              {requests.map((r) => (
                <li key={r.id}>
                  <div className="sr-request-row">
                    <div className="min-w-0">
                      <p className="sr-request-title">{r.title}</p>
                      <p className="sr-request-meta">
                        {r.platform ? `${r.platform} · ` : ""}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="sr-status">{statusLabel(r.status)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
