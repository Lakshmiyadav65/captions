"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Segment } from "@/lib/transcription/types";
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
import { friendlyJobError } from "@/lib/errors";
import { PreviewStage } from "./PreviewStage";
import { StylePanel } from "./StylePanel";
import { SubtitleList } from "./SubtitleList";
import { DictionaryPanel } from "./DictionaryPanel";
import { QuotaBadge } from "./QuotaBadge";

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

export function Editor({
  jobId,
  videoUrl,
  originalName,
  initialStatus,
  width,
  height,
}: {
  jobId: string;
  videoUrl: string;
  originalName: string | null;
  initialStatus: string;
  /** Real video pixel dimensions (detected at upload) so the preview opens at the right ratio. */
  width?: number | null;
  height?: number | null;
}) {
  const [progress, setProgress] = useState<Progress>({
    status: initialStatus,
    progress: initialStatus === "done" ? 100 : 0,
  });
  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [style, setStyle] = useState<SubtitleStyle>({ ...DEFAULT_STYLE });
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
      baselineRef.current = data.segments.map((s) => ({ ...s, text: s.text }));
      setLearned(null);
    }
  }, [jobId]);

  // Follow job progress until it finishes, then load the transcript.
  useEffect(() => {
    if (progress.status === "done") {
      void loadTranscript();
      return;
    }
    if (progress.status === "failed") return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    es.onmessage = (e) => {
      const data = JSON.parse(e.data) as Progress;
      setProgress(data);
      if (data.status === "done") {
        es.close();
        void loadTranscript();
      } else if (data.status === "failed") {
        es.close();
      }
    };
    es.onerror = () => es.close();
    return () => es.close();
    // streamEpoch re-opens the stream after Retry.
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
      const data = (await res.json()) as { url?: string; filename?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Export failed");
      const a = document.createElement("a");
      a.href = data.url;
      a.download = data.filename ?? `${baseName}-captioned.mp4`;
      a.click();
      setExportState("idle");
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
      setExportState("error");
    }
  };

  const isProcessing =
    progress.status !== "done" && progress.status !== "failed";
  const isMock = progress.provider === "mock";

  return (
    <div
      className={`mx-auto flex max-w-7xl flex-col px-4 ${
        progress.status === "done"
          ? "h-dvh overflow-hidden py-4"
          : "py-6"
      }`}
    >
      <header className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <a href="/" className="text-sm text-sky-400 hover:text-sky-300">
            ← New video
          </a>
          <h1 className="mt-1 text-xl font-semibold text-white">
            {originalName ?? "Telugu captions"}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <QuotaBadge />
          {progress.status === "done" && (
            <>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={exportMp4}
                  disabled={exportState === "exporting"}
                  className="group relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-b from-sky-400 to-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_1px_0_rgba(255,255,255,0.25)_inset,0_8px_24px_-6px_rgba(14,165,233,0.55)] ring-1 ring-sky-300/40 transition hover:from-sky-300 hover:to-sky-500 hover:shadow-[0_1px_0_rgba(255,255,255,0.3)_inset,0_10px_28px_-4px_rgba(14,165,233,0.65)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition group-hover:opacity-100"
                  />
                  {exportState === "exporting" ? (
                    <>
                      <span
                        aria-hidden
                        className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
                      />
                      <span className="relative">Rendering video…</span>
                    </>
                  ) : (
                    <>
                      <svg
                        aria-hidden
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="relative h-4 w-4 shrink-0"
                      >
                        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.69L6.03 8.22a.75.75 0 0 0-1.06 1.06l4.5 4.5a.75.75 0 0 0 1.06 0l4.5-4.5a.75.75 0 1 0-1.06-1.06l-3.22 3.22V2.75Z" />
                        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                      </svg>
                      <span className="relative flex flex-col items-start leading-tight">
                        <span>Export video</span>
                        <span className="text-[10px] font-medium text-sky-100/90">
                          MP4 with burned captions
                        </span>
                      </span>
                    </>
                  )}
                </button>
                <span className="mx-0.5 hidden h-8 w-px bg-white/10 sm:block" aria-hidden />
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.ext}
                    type="button"
                    onClick={() => doExport(f.ext, f.mime)}
                    className="rounded-lg border border-white/10 bg-neutral-900/80 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-white/20 hover:bg-neutral-800 hover:text-white"
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {exportState === "exporting" && (
                <span className="text-xs text-neutral-500">
                  Burning captions into your video — this can take up to a minute.
                </span>
              )}
              {exportState === "error" && exportError && (
                <span className="text-xs text-red-400">{exportError}</span>
              )}
            </>
          )}
        </div>
      </header>

      {isProcessing && (
        <div className="mb-6 rounded-xl border border-white/10 bg-neutral-900 p-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-neutral-200">
              {STATUS_LABEL[progress.status] ?? progress.status}
            </span>
            <span className="tabular-nums text-neutral-400">
              {progress.progress}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-sky-500 transition-all duration-500"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <p className="mt-3 text-xs text-neutral-500">
            {progress.provider && progress.provider !== "mock"
              ? `Transcribing with ${progress.provider}.`
              : "Using the built-in sample transcript (no API key set)."}
          </p>
        </div>
      )}

      {progress.status === "failed" && (
        <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          <p className="font-medium">Processing failed</p>
          <p className="mt-1 text-red-300/80">
            {friendlyJobError(progress.error)}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void retryJob()}
              disabled={retrying}
              className="rounded-lg bg-red-500/20 px-3.5 py-2 text-sm font-medium text-red-100 ring-1 ring-red-400/40 transition hover:bg-red-500/30 disabled:opacity-60"
            >
              {retrying ? "Retrying…" : "Try again"}
            </button>
            <a href="/" className="text-sm text-sky-400 hover:text-sky-300">
              Upload a different video
            </a>
          </div>
          {retryError && (
            <p className="mt-2 text-xs text-amber-200/90">{retryError}</p>
          )}
        </div>
      )}

      {progress.status === "done" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overscroll-contain lg:grid-cols-[1fr_360px] lg:gap-6 lg:overflow-hidden">
          {/* Left: large preview; caption list is a fixed strip that scrolls on its own. */}
          <div className="flex min-h-0 flex-col gap-3 lg:overflow-hidden">
            {isMock && (
              <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                Showing a <strong>sample</strong> Telugu transcript. Add a Sarvam or
                OpenAI API key (see README) to transcribe your real audio.
              </div>
            )}
            <div className="min-h-[320px] flex-1 lg:min-h-0">
              <PreviewStage
                videoRef={videoRef}
                videoUrl={videoUrl}
                segments={displaySegments}
                style={style}
                onTime={setCurrentTime}
                initialAspect={width && height ? width / height : undefined}
                onPositionChange={(positionYPct) => patchStyle({ positionYPct })}
              />
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs text-neutral-500">
                  Detected language:{" "}
                  <span className="text-neutral-300">
                    {progress.language ?? "te"}
                  </span>
                  {saveState === "saving" && (
                    <span className="ml-2 text-neutral-500">· Saving…</span>
                  )}
                  {saveState === "saved" && (
                    <span className="ml-2 text-emerald-400/80">· Saved</span>
                  )}
                </p>
                <div className="inline-flex rounded-lg bg-neutral-800 p-0.5">
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
                      className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                        scriptMode === opt.id
                          ? "bg-sky-600 text-white"
                          : "text-neutral-400 hover:text-neutral-200"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={saveEdits}
                disabled={saveState === "saving"}
                className="rounded-lg border border-white/10 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
              >
                Save timings
              </button>
            </div>
            {learned && learned.length > 0 && (
              <div className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                Remembered{" "}
                {learned.map((r) => `${r.from} → ${r.to}`).join(" · ")} — will use
                next time
              </div>
            )}
            {segments && (
              <div className="h-[min(28vh,260px)] shrink-0 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-neutral-900/40 p-3 max-lg:h-[min(40vh,320px)]">
                <SubtitleList
                  segments={segments}
                  onChange={onSegmentsChange}
                  currentTime={currentTime}
                  onSeek={(t) => {
                    if (videoRef.current) videoRef.current.currentTime = t;
                  }}
                  onTextCommit={onTextCommit}
                />
              </div>
            )}
          </div>

          {/* Right: styles / fonts scroll on their own when the cursor is here. */}
          <aside className="min-h-0 max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-neutral-900 p-4 lg:max-h-none">
            <StylePanel
              style={style}
              onChange={patchStyle}
              onApplyPreset={(s) => setStyle({ ...s })}
            />
            <DictionaryPanel
              segments={segments}
              refreshToken={dictRefresh}
              onApplySegments={(next) => {
                setSegments(next);
                baselineRef.current = next.map((s) => ({ ...s, text: s.text }));
                schedulePersist(next);
              }}
            />
          </aside>
        </div>
      )}
    </div>
  );
}
