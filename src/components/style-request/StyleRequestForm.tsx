"use client";

import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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
    const ok = IMAGE_OK.test(next.name) || VIDEO_OK.test(next.name) || next.type.startsWith("image/") || next.type.startsWith("video/");
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
    <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-white/10 bg-neutral-900/60 p-6 sm:p-8">
        <div>
          <label htmlFor="style-title" className="block text-sm font-medium text-neutral-200">
            Style name
          </label>
          <input
            id="style-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Yellow kinetic pop like @creator"
            maxLength={120}
            className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-sky-500/60"
            required
          />
        </div>

        <div>
          <label htmlFor="style-platform" className="block text-sm font-medium text-neutral-200">
            Where did you see it?
          </label>
          <input
            id="style-platform"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            placeholder="Instagram Reels, YouTube Shorts, …"
            maxLength={80}
            className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-sky-500/60"
          />
        </div>

        <div>
          <label htmlFor="style-notes" className="block text-sm font-medium text-neutral-200">
            Details (optional)
          </label>
          <textarea
            id="style-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Colors, font feel, word pop / karaoke, outline, position — anything that helps us match it."
            rows={4}
            maxLength={2000}
            className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 outline-none focus:border-sky-500/60"
          />
        </div>

        <div>
          <p className="text-sm font-medium text-neutral-200">
            Reference media <span className="font-normal text-neutral-500">(video preferred)</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">
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
            className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-10 text-center transition ${
              dragging
                ? "border-sky-400 bg-sky-500/10"
                : "border-white/15 bg-neutral-950/80 hover:border-white/30"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,.mkv,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <span className="text-sm font-medium text-neutral-100">
              {file ? file.name : "Drop screenshot or reference video"}
            </span>
            <span className="mt-1 text-xs text-neutral-500">
              {file
                ? `${(file.size / (1024 * 1024)).toFixed(1)} MB · click to change`
                : "PNG, JPEG, WebP · MP4, MOV, WebM"}
            </span>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex w-full items-center justify-center rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[220px]"
        >
          {submitting ? "Sending…" : "Request this style"}
        </button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-300">Beta</p>
          <h2 className="mt-2 text-lg font-semibold text-white">How it works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-sm text-neutral-300">
            <li>Sign in and describe the caption look you want.</li>
            <li>Upload a reference video (best) or a sharp screenshot.</li>
            <li>We build the style and drop it into your presets within ~24 hours.</li>
          </ol>
          <p className="mt-4 text-xs text-neutral-500">
            Prefer the instant{" "}
            <a href="/style-analyzer" className="text-sky-400 hover:text-sky-300">
              Style Analyzer
            </a>{" "}
            if a single screenshot is enough — use this form when you need a handcrafted match.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-white">Your requests</h2>
            <a href="/styles" className="text-xs text-sky-400 hover:text-sky-300">
              My Styles →
            </a>
          </div>
          {loadingList ? (
            <p className="mt-3 text-sm text-neutral-500">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">No requests yet. Submit your first look above.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {requests.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-white/10 bg-neutral-950/70 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-neutral-100">{r.title}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {r.platform ? `${r.platform} · ` : ""}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-300">
                      {statusLabel(r.status)}
                    </span>
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
