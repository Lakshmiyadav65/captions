"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Segment } from "@/lib/transcription/types";
import {
  estimateWordsPerFrame,
  rescaleSegmentsToMaxWords,
  WORDS_PER_FRAME_DEFAULT,
} from "@/lib/transcription/util";
import {
  DEFAULT_STYLE,
  EXPORT_FORMATS,
  renderSubtitles,
  type SubtitleFormat,
  type SubtitleStyle,
} from "@/lib/subtitles";
import {
  applySpelling,
  diffWordCorrections,
  type SpellRule,
} from "@/lib/spelling";
import {
  displayInScript,
  type ScriptDisplay,
} from "@/lib/transliterate";
import { stripFillers } from "@/lib/transcript-edit";
import { friendlyJobError } from "@/lib/errors";
import { PreviewStage } from "./PreviewStage";
import { StylePanel } from "./StylePanel";
import { SubtitleList } from "./SubtitleList";
import { DictionaryPanel } from "./DictionaryPanel";
import { QuotaBadge } from "./QuotaBadge";
import { AppShell, type ConsoleUser } from "@/components/console/AppShell";
import { formatTime } from "./EditorTimeline";
import Link from "next/link";

interface Progress {
  status: string;
  progress: number;
  provider?: string;
  language?: string | null;
  error?: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued…",
  extracting: "Extracting audio…",
  transcribing: "Transcribing Telugu…",
  done: "Ready",
  failed: "Failed",
};

function download(name: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Fetch the export and save via a blob: URL so Chrome doesn't fail on cross-origin CDN links. */
async function downloadFromUrl(url: string, filename: string) {
  const raw = url.startsWith("http")
    ? url
    : new URL(url, window.location.origin).toString();

  // Prefer the plain file URL — Chrome often fails ?download=1 cross-origin with
  // "File wasn't available on site".
  let abs = raw;
  try {
    const parsed = new URL(raw);
    parsed.searchParams.delete("download");
    abs = parsed.toString();
  } catch {
    /* keep raw */
  }

  const safeName = filename.endsWith(".mp4") ? filename : `${filename}.mp4`;

  // Fetch → blob download (best filename control). Fall back to opening the CDN URL
  // when CORS / network blocks the fetch — public Blob URLs still download fine that way.
  try {
    const res = await fetch(abs);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.size) {
        const objectUrl = URL.createObjectURL(blob);
        try {
          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = safeName;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          a.remove();
          await new Promise((r) => setTimeout(r, 1500));
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
        return;
      }
    }
  } catch {
    /* fall through to direct link */
  }

  const a = document.createElement("a");
  a.href = abs;
  a.download = safeName;
  a.target = "_blank";
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function Editor({
  jobId,
  videoUrl,
  originalName,
  initialStatus,
  initialProgress = 0,
  initialProvider = null,
  initialLanguage = null,
  initialError = null,
  width,
  height,
  user = null,
}: {
  jobId: string;
  videoUrl: string;
  originalName: string | null;
  initialStatus: string;
  initialProgress?: number;
  initialProvider?: string | null;
  initialLanguage?: string | null;
  initialError?: string | null;
  /** Real video pixel dimensions (detected at upload) so the preview opens at the right ratio. */
  width?: number | null;
  height?: number | null;
  user?: ConsoleUser | null;
}) {
  const [progress, setProgress] = useState<Progress>({
    status: initialStatus,
    progress:
      initialStatus === "done"
        ? 100
        : initialStatus === "failed"
          ? initialProgress
          : Math.max(0, initialProgress),
    provider: initialProvider ?? undefined,
    language: initialLanguage,
    error: initialError,
  });
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [style, setStyle] = useState<SubtitleStyle>({ ...DEFAULT_STYLE });
  /** How many words appear in each on-screen caption frame (1–6). */
  const [wordsPerFrame, setWordsPerFrame] = useState(WORDS_PER_FRAME_DEFAULT);
  const [scriptMode, setScriptMode] = useState<ScriptDisplay>("roman");
  const [currentTime, setCurrentTime] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [exportState, setExportState] = useState<"idle" | "exporting" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  /** Word fixes auto-learned when the user edits a caption line. */
  const [learned, setLearned] = useState<SpellRule[] | null>(null);
  /** Bump to refresh DictionaryPanel after auto-learn. */
  const [dictRefresh, setDictRefresh] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  /** Bumped on retry so the SSE effect re-subscribes after a failure. */
  const [streamEpoch, setStreamEpoch] = useState(0);
  const [styleTab, setStyleTab] = useState<"preset" | "text" | "effect" | "position">("preset");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** Per-line ASR/previous text — used to detect what the user just fixed. */
  const baselineRef = useRef<Segment[] | null>(null);
  const segmentsRef = useRef<Segment[] | null>(null);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const learnBusy = useRef(false);

  const baseName = (originalName ?? "telugu-captions").replace(/\.[^.]+$/, "");

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const persistTranscript = useCallback(
    async (segs: Segment[]) => {
      setSaveState("saving");
      await fetch(`/api/transcript/${jobId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segments: segs }),
      });
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 1500);
    },
    [jobId],
  );

  const schedulePersist = useCallback(
    (segs: Segment[]) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        void persistTranscript(segs);
      }, 400);
    },
    [persistTranscript],
  );

  const loadTranscript = useCallback(async () => {
    const res = await fetch(`/api/transcript/${jobId}`);
    if (res.ok) {
      const data = (await res.json()) as { segments: Segment[] };
      setSegments(data.segments);
      setWordsPerFrame(estimateWordsPerFrame(data.segments));
      baselineRef.current = data.segments.map((s) => ({ ...s, text: s.text }));
      setLearned(null);
    }
  }, [jobId]);

  /** Rebuild caption frames at a new word density and persist. */
  const onWordsPerFrameChange = useCallback(
    (n: number) => {
      const current = segmentsRef.current;
      if (!current) {
        setWordsPerFrame(n);
        return;
      }
      const next = rescaleSegmentsToMaxWords(current, n);
      setWordsPerFrame(n);
      setSegments(next);
      baselineRef.current = next.map((s) => ({ ...s, text: s.text }));
      schedulePersist(next);
    },
    [schedulePersist],
  );

  // Follow job progress until it finishes, then load the transcript.
  // Prefer SSE; if the stream drops, fall back to polling so we never sit on a stale "Extracting…".
  useEffect(() => {
    let cancelled = false;
    let es: EventSource | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let finished = initialStatus === "done" || initialStatus === "failed";

    if (initialStatus === "done") {
      void loadTranscript();
    }

    const stop = () => {
      es?.close();
      es = null;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const apply = (data: Progress) => {
      if (cancelled) return;
      setProgress(data);
      if (data.status === "done") {
        if (!finished) void loadTranscript();
        finished = true;
        stop();
      } else if (data.status === "failed") {
        finished = true;
        stop();
      }
    };

    const pollOnce = async (): Promise<Progress | null> => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { cache: "no-store" });
        if (!res.ok) return null;
        const data = (await res.json()) as Progress;
        apply(data);
        return data;
      } catch {
        return null;
      }
    };

    const startPolling = () => {
      if (pollTimer || cancelled || finished) return;
      pollTimer = setInterval(() => void pollOnce(), 1500);
    };

    if (finished) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      // Always re-read DB first (covers refresh after processing finished).
      const latest = await pollOnce();
      if (cancelled || finished) return;
      if (latest && (latest.status === "done" || latest.status === "failed")) return;

      es = new EventSource(`/api/jobs/${jobId}/stream`);
      es.onmessage = (e) => {
        try {
          apply(JSON.parse(e.data) as Progress);
        } catch {
          /* ignore bad frames */
        }
      };
      es.onerror = () => {
        es?.close();
        es = null;
        startPolling();
      };
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // streamEpoch re-opens after Retry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId, streamEpoch]);

  // Apply a style handed over from the Style Analyzer / My Styles ("Use in editor").
  useEffect(() => {
    const pending = sessionStorage.getItem("pendingStyle");
    if (!pending) return;
    try {
      setStyle({ ...DEFAULT_STYLE, ...(JSON.parse(pending) as Partial<SubtitleStyle>) });
    } catch {}
    sessionStorage.removeItem("pendingStyle");
  }, []);

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const patchStyle = (patch: Partial<SubtitleStyle>) =>
    setStyle((s) => ({ ...s, ...patch }));

  /** Structural edits (add/delete line) shift indices — resync baseline so we don't learn junk. */
  const onSegmentsChange = useCallback((next: Segment[]) => {
    const prev = segmentsRef.current;
    setSegments(next);
    if (!prev || prev.length !== next.length) {
      baselineRef.current = next.map((s) => ({ ...s, text: s.text }));
    }
  }, []);

  /**
   * When the user finishes editing a caption line: learn word fixes into memory,
   * apply them across this transcript, and auto-save — no Listener panel / Save click.
   */
  const onTextCommit = useCallback(
    async (index: number, text: string) => {
      const current = segmentsRef.current;
      const baseline = baselineRef.current;
      if (!current || !baseline || learnBusy.current) return;

      // Keep timings from the live list; text comes from the blurred field.
      let next = current.map((s, i) => (i === index ? { ...s, text } : s));

      // Insert/delete left arrays out of sync — persist text, skip learning.
      if (baseline.length !== current.length || !baseline[index]) {
        setSegments(next);
        baselineRef.current = next.map((s) => ({ ...s, text: s.text }));
        schedulePersist(next);
        return;
      }

      const before = baseline[index]?.text ?? "";
      const rules = diffWordCorrections(before, text);

      if (rules.length) {
        learnBusy.current = true;
        try {
          await fetch("/api/spelling", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rules }),
          });
          next = next.map((s) => ({
            ...s,
            text: applySpelling(s.text, rules),
            words: s.words?.map((w) => ({
              ...w,
              text: applySpelling(w.text, rules),
            })),
          }));
          setLearned(rules);
          setDictRefresh((n) => n + 1);
          setTimeout(() => setLearned(null), 4000);
        } finally {
          learnBusy.current = false;
        }
      }

      setSegments(next);
      baselineRef.current = next.map((s) => ({ ...s, text: s.text }));
      schedulePersist(next);
    },
    [schedulePersist],
  );

  const retryJob = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryError(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/retry`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Retry failed");
      setProgress({ status: "queued", progress: 0, error: null });
      setStreamEpoch((n) => n + 1);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  };

  // Manual save still available for timing tweaks without leaving a text field.
  const saveEdits = async () => {
    if (!segments) return;
    baselineRef.current = segments.map((s) => ({ ...s, text: s.text }));
    await persistTranscript(segments);
  };

  const displaySegments = useMemo(() => {
    if (!segments) return [];
    if (scriptMode === "roman") {
      return segments.map((s) => ({
        ...s,
        text: displayInScript(s.text, "roman"),
        words: s.words?.map((w) => ({
          ...w,
          text: displayInScript(w.text, "roman"),
        })),
      }));
    }
    return segments.map((s) => ({
      ...s,
      text: displayInScript(s.text, "telugu"),
      words: s.words?.map((w) => ({
        ...w,
        text: displayInScript(w.text, "telugu"),
      })),
    }));
  }, [segments, scriptMode]);

  const doExport = (fmt: SubtitleFormat, mime: string) => {
    if (!segments) return;
    download(`${baseName}.${fmt}`, renderSubtitles(fmt, displaySegments, style), mime);
  };

  const exportMp4 = async () => {
    if (!segments || exportState === "exporting") return;
    setExportState("exporting");
    setExportError(null);
    try {
      const res = await fetch(`/api/export/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, segments: displaySegments }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        filename?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Export failed (${res.status})`);
      }
      await downloadFromUrl(
        data.url,
        data.filename ?? `${baseName}-captioned.mp4`,
      );
      setExportState("idle");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
      setExportState("error");
    }
  };

  const isProcessing =
    progress.status !== "done" && progress.status !== "failed";
  const isMock = progress.provider === "mock";

  const seekTo = (t: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, t);
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const togglePlay = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (v.paused) {
        // Restart from the beginning when the clip has ended.
        if (v.ended) v.currentTime = 0;
        await v.play();
      } else {
        v.pause();
      }
    } catch {
      // AbortError when a play() is interrupted by pause() — ignore.
    }
    setPlaying(!v.paused);
  };

  const toggleFullscreen = async () => {
    const stage = document.querySelector(".preview-stage");
    if (!(stage instanceof HTMLElement)) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      // Browser blocked fullscreen (permissions / unsupported).
    }
  };

  /* —— Processing / failed: keep simple shell with sidebar off —— */
  if (progress.status !== "done") {
    return (
      <AppShell section="editor" user={user} showSidebar={false}>
        <div className="ed-root">
          <header className="ed-header">
          <Link href="/library" className="ed-back" aria-label="Back to library">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="10" y1="3" x2="5" y2="8" />
              <line x1="5" y1="8" x2="10" y2="13" />
            </svg>
          </Link>
          <div className="ed-title-wrap">
            <h1 className="ed-title">{originalName ?? "Telugu captions"}</h1>
            <div className="ed-meta">
              {STATUS_LABEL[progress.status] ?? progress.status}
            </div>
          </div>
          <div className="ed-header-actions">
            <QuotaBadge />
          </div>
          </header>
          <div className="tc-editor flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-4">
            {isProcessing && (
              <div
                className="mb-6 rounded-xl p-6"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                    {STATUS_LABEL[progress.status] ?? progress.status}
                  </span>
                  <span className="tabular-nums" style={{ color: "var(--ink-3)" }}>
                    {progress.progress}%
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ background: "var(--track)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${progress.progress}%`,
                      background: "var(--accent)",
                    }}
                  />
                </div>
                <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>
                  {progress.provider === "mock"
                    ? "Using the built-in sample transcript (no ASR API key set)."
                    : progress.status === "extracting"
                      ? "Pulling audio from your video — this usually takes a few seconds."
                      : progress.status === "transcribing"
                        ? "Transcribing Telugu. Longer clips can take a few minutes — audio is sent in short pieces."
                        : "Preparing your captions…"}
                </p>
              </div>
            )}
            {progress.status === "failed" && (
              <div
                className="mb-6 rounded-xl p-6 text-sm"
                style={{
                  border: "1px solid rgba(240,112,95,.3)",
                  background: "var(--danger-wash)",
                  color: "var(--danger)",
                }}
              >
                <p className="font-medium">Processing failed</p>
                <p className="mt-1" style={{ opacity: 0.85 }}>
                  {friendlyJobError(progress.error)}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => void retryJob()}
                    disabled={retrying}
                    className="tc-btn tc-btn--sm"
                  >
                    {retrying ? "Retrying…" : "Try again"}
                  </button>
                  <a href="/#upload" className="text-sm">
                    Upload a different video
                  </a>
                </div>
                {retryError && (
                  <p className="mt-2 text-xs" style={{ color: "var(--warn)" }}>
                    {retryError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell section="editor" user={user} showSidebar={false}>
      <div className="ed-root">
        <header className="ed-header">
          <Link href="/library" className="ed-back" aria-label="Back to library">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="10" y1="3" x2="5" y2="8" />
              <line x1="5" y1="8" x2="10" y2="13" />
            </svg>
          </Link>
          <div className="ed-title-wrap">
            <h1 className="ed-title">{originalName ?? "Untitled project"}</h1>
            <div className="ed-meta">
              {formatTime(duration || currentTime)}
              {width && height ? ` · ${width}×${height}` : ""}
              {saveState === "saving"
                ? " · saving…"
                : saveState === "saved"
                  ? " · saved"
                  : ""}
            </div>
          </div>
          <div className="ed-header-actions">
            {exportState === "exporting" && (
              <span className="text-xs" style={{ color: "var(--ed-soft)" }}>
                Burning captions…
              </span>
            )}
            {exportState === "error" && exportError && (
              <span className="text-xs" style={{ color: "var(--danger)" }}>
                {exportError}
              </span>
            )}
            <QuotaBadge />
            <details className="ed-export-menu">
              <summary>
                Subtitles <span style={{ fontSize: 8, color: "var(--ed-muted)" }}>▾</span>
              </summary>
              <div className="ed-export-list">
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.ext}
                    type="button"
                    onClick={(e) => {
                      doExport(f.ext, f.mime);
                      (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </details>
            <button
              type="button"
              onClick={exportMp4}
              disabled={exportState === "exporting"}
              className="tc-btn tc-btn--primary tc-btn--sm"
            >
              {exportState === "exporting" ? "Rendering…" : "Export MP4"}
            </button>
          </div>
        </header>

        <div className="ed-body">
          <div className={`ed-workspace${leftCollapsed ? " is-left-collapsed" : ""}`}>
            {!leftCollapsed && (
              <section className="ed-panel ed-left">
                <button
                  type="button"
                  className="ed-panel-collapse"
                  aria-label="Collapse panel"
                  onClick={() => setLeftCollapsed(true)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 6l-6 6 6 6" />
                  </svg>
                </button>
                <div className="ed-panel-head">
                  <div className="ed-panel-head-row">
                    <b>Transcript</b>
                    <span className="ed-count">
                      {segments?.length ?? 0} lines
                    </span>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      className="ed-chip"
                      title="Remove um / uh / ante / you know (F)"
                      onClick={() => {
                        if (!segments) return;
                        onSegmentsChange(stripFillers(segments));
                      }}
                    >
                      Strip fillers
                    </button>
                  </div>
                  <div className="ed-panel-head-row">
                    <div className="tc-seg">
                      {(
                        [
                          { id: "roman" as const, label: "Roman" },
                          { id: "telugu" as const, label: "తెలుగు" },
                        ]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setScriptMode(opt.id)}
                          aria-pressed={scriptMode === opt.id}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <span style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={saveEdits}
                      disabled={saveState === "saving"}
                      className="tc-btn tc-btn--sm"
                      style={{
                        background: "var(--ed-ink)",
                        color: "#fff",
                        borderColor: "var(--ed-ink)",
                      }}
                    >
                      {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"}
                    </button>
                  </div>
                  <div className="ed-keys">
                    <span>J / K</span> next · prev
                    <span>S</span> split
                    <span>M</span> merge
                  </div>
                </div>
                <div className="ed-panel-body">
                  {isMock && (
                    <p className="mb-2 text-xs" style={{ color: "var(--warn)" }}>
                      Sample transcript — add an ASR key for real audio.
                    </p>
                  )}
                  {learned && learned.length > 0 && (
                    <p className="mb-2 text-xs" style={{ color: "var(--ok)" }}>
                      Remembered {learned.map((r) => `${r.from} → ${r.to}`).join(" · ")}
                    </p>
                  )}
                  {segments && (
                    <SubtitleList
                      segments={segments}
                      onChange={onSegmentsChange}
                      currentTime={currentTime}
                      onSeek={seekTo}
                      onTextCommit={onTextCommit}
                      embedded
                    />
                  )}
                </div>
              </section>
            )}

            <section className="ed-center">
              <div className="ed-stage-tools">
                {leftCollapsed ? (
                  <button
                    type="button"
                    className="ed-chip"
                    onClick={() => setLeftCollapsed(false)}
                  >
                    Show captions
                  </button>
                ) : (
                  <Link href="/#upload" className="ed-chip">
                    Replace video
                  </Link>
                )}
                <span className="ed-chip">
                  {width && height
                    ? Math.abs(width / height - 9 / 16) < 0.08
                      ? "9:16"
                      : Math.abs(width / height - 16 / 9) < 0.08
                        ? "16:9"
                        : Math.abs(width / height - 1) < 0.08
                          ? "1:1"
                          : `${width}×${height}`
                    : "9:16"}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  type="button"
                  className="ed-chip"
                  onClick={() => {
                    void toggleFullscreen();
                  }}
                >
                  Full screen
                </button>
              </div>
              <div className="ed-preview-frame">
                <PreviewStage
                  videoRef={videoRef}
                  videoUrl={videoUrl}
                  segments={displaySegments}
                  style={style}
                  onTime={setCurrentTime}
                  onPlayingChange={setPlaying}
                  onDuration={setDuration}
                  initialAspect={width && height ? width / height : undefined}
                  onPositionChange={(positionYPct) => patchStyle({ positionYPct })}
                />
              </div>
              <div className="ed-transport">
                <div className="ed-transport-btns">
                  <button type="button" aria-label="Back 5s" onClick={() => seekTo(currentTime - 5)}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                      <polygon points="12,3 12,13 5,8" />
                      <rect x="3" y="3" width="1.6" height="10" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="ed-play"
                    aria-label={playing ? "Pause" : "Play"}
                    onClick={() => {
                      void togglePlay();
                    }}
                  >
                    {playing ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <polygon points="4,2.5 13,8 4,13.5" />
                      </svg>
                    )}
                  </button>
                  <button type="button" aria-label="Forward 5s" onClick={() => seekTo(currentTime + 5)}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                      <polygon points="4,3 4,13 11,8" />
                      <rect x="11.4" y="3" width="1.6" height="10" />
                    </svg>
                  </button>
                </div>
                <div className="ed-time">
                  <b>{formatTime(currentTime)}</b>
                  {" "}
                  <span>/</span>
                  {" "}
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </section>

            <aside className="ed-panel ed-right">
              <div className="ed-tabs" role="tablist">
                {(
                  [
                    { id: "preset" as const, label: "Style" },
                    { id: "text" as const, label: "Text" },
                    { id: "effect" as const, label: "Motion" },
                    { id: "position" as const, label: "Position" },
                  ]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    className={styleTab === tab.id ? "is-active" : undefined}
                    aria-selected={styleTab === tab.id}
                    onClick={() => setStyleTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="ed-panel-body ed-inspector">
                <StylePanel
                  style={style}
                  onChange={patchStyle}
                  onApplyPreset={(s) => setStyle({ ...s })}
                  wordsPerFrame={wordsPerFrame}
                  onWordsPerFrameChange={onWordsPerFrameChange}
                  panel={styleTab === "position" ? "position" : styleTab}
                />
                {styleTab === "text" && (
                  <DictionaryPanel
                    segments={segments}
                    refreshToken={dictRefresh}
                    onApplySegments={(next) => {
                      setSegments(next);
                      baselineRef.current = next.map((s) => ({ ...s, text: s.text }));
                      schedulePersist(next);
                    }}
                  />
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
