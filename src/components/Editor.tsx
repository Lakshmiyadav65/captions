"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { PreviewStage } from "./PreviewStage";
import { StylePanel } from "./StylePanel";
import { SubtitleList } from "./SubtitleList";

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
  const [currentTime, setCurrentTime] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [exportState, setExportState] = useState<"idle" | "exporting" | "error">("idle");
  const [exportError, setExportError] = useState<string | null>(null);
  /** Word fixes auto-learned when the user edits a caption line. */
  const [learned, setLearned] = useState<SpellRule[] | null>(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

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

  // Manual save still available for timing tweaks without leaving a text field.
  const saveEdits = async () => {
    if (!segments) return;
    baselineRef.current = segments.map((s) => ({ ...s, text: s.text }));
    await persistTranscript(segments);
  };

  const doExport = (fmt: SubtitleFormat, mime: string) => {
    if (!segments) return;
    download(`${baseName}.${fmt}`, renderSubtitles(fmt, segments, style), mime);
  };

  const exportMp4 = async () => {
    if (!segments || exportState === "exporting") return;
    setExportState("exporting");
    setExportError(null);
    try {
      const res = await fetch(`/api/export/${jobId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ style, segments }),
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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <a href="/" className="text-sm text-sky-400 hover:text-sky-300">
            ← New video
          </a>
          <h1 className="mt-1 text-xl font-semibold text-white">
            {originalName ?? "Telugu captions"}
          </h1>
        </div>
        {progress.status === "done" && (
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={exportMp4}
                disabled={exportState === "exporting"}
                className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exportState === "exporting" ? "⏳ Rendering MP4…" : "⬇ Export MP4"}
              </button>
              <span className="mx-1 h-6 w-px bg-white/10" aria-hidden />
              {EXPORT_FORMATS.map((f) => (
                <button
                  key={f.ext}
                  type="button"
                  onClick={() => doExport(f.ext, f.mime)}
                  className="rounded-lg bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700"
                >
                  ↓ {f.label}
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
          </div>
        )}
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
          <p className="mt-1 text-red-300/80">{progress.error}</p>
        </div>
      )}

      {progress.status === "done" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {isMock && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-200">
                Showing a <strong>sample</strong> Telugu transcript. Add a Sarvam or
                OpenAI API key (see README) to transcribe your real audio.
              </div>
            )}
            <PreviewStage
              videoRef={videoRef}
              videoUrl={videoUrl}
              segments={segments ?? []}
              style={style}
              onTime={setCurrentTime}
              initialAspect={width && height ? width / height : undefined}
              onPositionChange={(positionYPct) => patchStyle({ positionYPct })}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                Remembered{" "}
                {learned.map((r) => `${r.from} → ${r.to}`).join(" · ")} — will use
                next time
              </div>
            )}
            {segments && (
              <SubtitleList
                segments={segments}
                onChange={setSegments}
                currentTime={currentTime}
                onSeek={(t) => {
                  if (videoRef.current) videoRef.current.currentTime = t;
                }}
                onTextCommit={onTextCommit}
              />
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
            <div className="rounded-xl border border-white/10 bg-neutral-900 p-4">
              <StylePanel
                style={style}
                onChange={patchStyle}
                onApplyPreset={(s) => setStyle({ ...s })}
              />
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
