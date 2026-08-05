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
import { friendlyJobError } from "@/lib/errors";
import { PreviewStage } from "./PreviewStage";
import { StylePanel } from "./StylePanel";
import { SubtitleList } from "./SubtitleList";
import { DictionaryPanel } from "./DictionaryPanel";
import { QuotaBadge } from "./QuotaBadge";
import { AppShell, type ConsoleUser } from "@/components/console/AppShell";

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
  width,
  height,
  user = null,
}: {
  jobId: string;
  videoUrl: string;
  originalName: string | null;
  initialStatus: string;
  /** Real video pixel dimensions (detected at upload) so the preview opens at the right ratio. */
  width?: number | null;
  height?: number | null;
  user?: ConsoleUser | null;
}) {
  const [progress, setProgress] = useState<Progress>({
    status: initialStatus,
    progress: initialStatus === "done" ? 100 : 0,
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

  return (
    <AppShell
      section="editor"
      user={user}
      showSidebar={false}
      title={originalName ?? "Telugu captions"}
      titleExtra={
        progress.status === "done" ? (
          <span className="tc-tag tc-tag--work">editing</span>
        ) : progress.status === "failed" ? (
          <span className="tc-tag tc-tag--fail">failed</span>
        ) : (
          <span className="tc-tag tc-tag--draft">{STATUS_LABEL[progress.status] ?? progress.status}</span>
        )
      }
      headActions={
        progress.status === "done" ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <QuotaBadge />
            <button
              type="button"
              onClick={exportMp4}
              disabled={exportState === "exporting"}
              className="tc-btn tc-btn--primary tc-btn--sm"
            >
              {exportState === "exporting" ? "Rendering…" : "Export MP4"}
            </button>
            {EXPORT_FORMATS.map((f) => (
              <button
                key={f.ext}
                type="button"
                onClick={() => doExport(f.ext, f.mime)}
                className="tc-btn tc-btn--sm"
              >
                {f.label}
              </button>
            ))}
          </div>
        ) : (
          <QuotaBadge />
        )
      }
    >
      <div
        className={`tc-editor flex min-h-0 flex-1 flex-col px-4 ${
          progress.status === "done" ? "overflow-hidden py-3" : "overflow-y-auto py-4"
        }`}
      >
        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <a href="/library" className="text-sm" style={{ color: "var(--accent)" }}>
            ← Library
          </a>
          {exportState === "exporting" && (
            <span className="text-xs" style={{ color: "var(--ink-3)" }}>
              Burning captions, then saving the MP4…
            </span>
          )}
          {exportState === "error" && exportError && (
            <span className="text-xs" style={{ color: "var(--danger)" }}>
              {exportError}
            </span>
          )}
        </div>

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
            style={{ background: "var(--bg)" }}
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
            {progress.provider && progress.provider !== "mock"
              ? "Transcribing your audio. Longer clips can take several minutes — audio is sent in short pieces."
              : "Using the built-in sample transcript (no API key set)."}
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

      {progress.status === "done" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto overscroll-contain lg:grid-cols-[420px_minmax(0,1fr)_340px] lg:gap-6 lg:overflow-hidden">
          {/* Left: video preview */}
          <section className="order-1 flex min-h-0 flex-col gap-3 lg:overflow-hidden">
            {isMock && (
              <div
                className="shrink-0 rounded-lg px-4 py-2.5 text-xs"
                style={{
                  border: "1px solid rgba(232,179,65,.3)",
                  background: "var(--warn-wash)",
                  color: "var(--warn)",
                }}
              >
                Showing a <strong>sample</strong> Telugu transcript. Add a transcription
                API key (see README) to transcribe your real audio.
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
          </section>

          {/* Center: transcript and timings */}
          <section className="order-2 flex min-h-0 flex-col gap-3 lg:overflow-hidden">
            <div
              className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-xl p-3"
              style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs" style={{ color: "var(--ink-3)" }}>
                  Detected language:{" "}
                  <span style={{ color: "var(--ink-2)" }}>
                    {progress.language ?? "te"}
                  </span>
                  {saveState === "saving" && (
                    <span className="ml-2" style={{ color: "var(--ink-3)" }}>
                      · Saving…
                    </span>
                  )}
                  {saveState === "saved" && (
                    <span className="ml-2" style={{ color: "var(--ok)" }}>
                      · Saved
                    </span>
                  )}
                </p>
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
              </div>
              <button
                type="button"
                onClick={saveEdits}
                disabled={saveState === "saving"}
                className="tc-btn tc-btn--sm"
              >
                Save timings
              </button>
            </div>
            {learned && learned.length > 0 && (
              <div
                className="shrink-0 rounded-lg px-3 py-2 text-xs"
                style={{
                  border: "1px solid rgba(95,208,138,.3)",
                  background: "var(--ok-wash)",
                  color: "var(--ok)",
                }}
              >
                Remembered{" "}
                {learned.map((r) => `${r.from} → ${r.to}`).join(" · ")} — will use
                next time
              </div>
            )}
            {segments && (
              <div
                className="min-h-[320px] flex-1 overflow-y-auto overscroll-contain rounded-xl p-3"
                style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
              >
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
          </section>

          {/* Right: style / editor settings */}
          <aside
            className="order-3 min-h-0 max-h-[70vh] overflow-y-auto overscroll-contain rounded-xl p-4 lg:max-h-none"
            style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
          >
            <StylePanel
              style={style}
              onChange={patchStyle}
              onApplyPreset={(s) => setStyle({ ...s })}
              wordsPerFrame={wordsPerFrame}
              onWordsPerFrameChange={onWordsPerFrameChange}
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
    </AppShell>
  );
}
