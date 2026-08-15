"use client";

import { useMemo } from "react";

const STEPS = [
  { id: "queued", label: "Queued" },
  { id: "extracting", label: "Extract" },
  { id: "transcribing", label: "Transcribe" },
] as const;

const GLYPHS = ["అ", "క", "త", "న", "మ", "ర", "ల", "వ", "స", "హ", "య", "ప"];

function stepIndex(status: string): number {
  if (status === "transcribing") return 2;
  if (status === "extracting") return 1;
  if (status === "queued") return 0;
  return 0;
}

function statusCopy(status: string, isMock: boolean): string {
  if (isMock) return "Using the built-in sample transcript (no ASR API key set).";
  if (status === "extracting")
    return "Pulling audio from your video — usually just a few seconds.";
  if (status === "transcribing")
    return "Listening in Telugu. Longer clips take a few minutes — audio goes in short pieces.";
  if (status === "queued") return "Your job is next in line.";
  return "Preparing your captions…";
}

export function ProcessingView({
  videoUrl,
  originalName,
  status,
  progress,
  provider,
  width,
  height,
}: {
  videoUrl: string;
  originalName: string | null;
  status: string;
  progress: number;
  provider?: string;
  width?: number | null;
  height?: number | null;
}) {
  const isMock = provider === "mock";
  const active = stepIndex(status);
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const aspect =
    width && height && width > 0 && height > 0 ? width / height : 9 / 16;

  const wave = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const mid = 13.5;
        const dist = Math.abs(i - mid) / mid;
        const base = 0.28 + (1 - dist) * 0.55;
        const jitter = ((i * 37) % 11) / 40;
        return Math.min(1, base + jitter);
      }),
    [],
  );

  const floating = useMemo(
    () =>
      GLYPHS.map((g, i) => ({
        g,
        left: `${8 + ((i * 17) % 84)}%`,
        top: `${12 + ((i * 29) % 70)}%`,
        delay: `${(i * 0.35) % 4}s`,
        size: 18 + ((i * 7) % 16),
      })),
    [],
  );

  const headline =
    status === "extracting"
      ? "Hearing the audio"
      : status === "transcribing"
        ? "Writing Telugu"
        : status === "queued"
          ? "Almost listening"
          : "Preparing captions";

  return (
    <div className="ed-process" aria-live="polite" aria-busy="true">
      <div className="ed-process-glow" aria-hidden />
      <div className="ed-process-glyphs" aria-hidden>
        {floating.map((f, i) => (
          <span
            key={i}
            className="ed-process-glyph"
            style={{
              left: f.left,
              top: f.top,
              animationDelay: f.delay,
              fontSize: f.size,
            }}
          >
            {f.g}
          </span>
        ))}
      </div>

      <div className="ed-process-stage">
        <div
          className="ed-process-frame"
          style={{ aspectRatio: String(aspect) }}
        >
          <video
            src={videoUrl}
            muted
            playsInline
            preload="auto"
            className="ed-process-video"
            onLoadedData={(e) => {
              const v = e.currentTarget;
              if (v.currentTime < 0.05) v.currentTime = 0.1;
            }}
          />
          <div className="ed-process-veil" aria-hidden />
          <div className="ed-process-ring" aria-hidden />

          <div className="ed-process-hud">
            <p className="ed-process-kicker">
              {originalName ? originalName.replace(/\.[^.]+$/, "") : "Caplio"}
            </p>
            <h2 className="ed-process-title">{headline}</h2>

            <div className="ed-process-meter" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <span className="ed-process-pct">
                {pct}
                <small>%</small>
              </span>
              <div className="ed-process-wave" aria-hidden>
                {wave.map((h, i) => (
                  <i
                    key={i}
                    style={{
                      ["--h" as string]: h,
                      animationDelay: `${(i % 10) * 0.08}s`,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="ed-process-bar">
              <div className="ed-process-bar-fill" style={{ width: `${pct}%` }} />
            </div>

            <ol className="ed-process-steps">
              {STEPS.map((s, i) => {
                const state =
                  i < active ? "done" : i === active ? "active" : "todo";
                return (
                  <li key={s.id} data-state={state}>
                    <span className="ed-process-step-dot" />
                    <span>{s.label}</span>
                  </li>
                );
              })}
              <li data-state="todo">
                <span className="ed-process-step-dot" />
                <span>Captions</span>
              </li>
            </ol>

            <p className="ed-process-copy">{statusCopy(status, isMock)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProcessingFailed({
  error,
  retrying,
  retryError,
  onRetry,
}: {
  error: string | null | undefined;
  retrying: boolean;
  retryError: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="ed-process ed-process--failed">
      <div className="ed-process-glow" aria-hidden />
      <div className="ed-process-fail">
        <p className="ed-process-kicker">Something went wrong</p>
        <h2 className="ed-process-title">Processing failed</h2>
        <p className="ed-process-copy">{error}</p>
        <div className="ed-process-fail-actions">
          {error && /caption minutes/i.test(error) ? null : (
            <button
              type="button"
              onClick={onRetry}
              disabled={retrying}
              className="tc-btn tc-btn--primary"
            >
              {retrying ? "Retrying…" : "Try again"}
            </button>
          )}
          <a href="/#upload" className="ed-process-link">
            Upload a different video
          </a>
        </div>
        {retryError && <p className="ed-process-retry-err">{retryError}</p>}
      </div>
    </div>
  );
}
