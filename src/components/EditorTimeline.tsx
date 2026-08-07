"use client";

import type { RefObject } from "react";
import type { Segment } from "@/lib/transcription/types";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export function EditorTimeline({
  segments,
  currentTime,
  duration,
  videoRef,
  onSeek,
}: {
  segments: Segment[];
  currentTime: number;
  duration: number;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSeek: (t: number) => void;
}) {
  const dur = duration > 0 ? duration : Math.max(currentTime, 1);
  const pct = Math.min(100, Math.max(0, (currentTime / dur) * 100));
  const activeIdx = segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);

  const tickCount = Math.min(9, Math.max(4, Math.ceil(dur / 4) + 1));
  const ticks = Array.from({ length: tickCount }, (_, i) =>
    Math.round((i / Math.max(1, tickCount - 1)) * dur),
  );

  return (
    <div className="ed-timeline">
      <div className="ed-tl-toolbar">
        <span className="ed-chip">Split</span>
        <span className="ed-chip">Merge</span>
        <span style={{ flex: 1 }} />
        <span className="ed-tl-clock">
          {formatClock(currentTime)} <span>|</span> {formatClock(dur)}
        </span>
      </div>
      <div className="ed-tl-body">
        <div className="ed-tl-labels">
          <div />
          <div>
            <i className="ed-tl-dot" style={{ background: "var(--ed-accent)" }} />
            Captions
          </div>
          <div>
            <i className="ed-tl-dot" style={{ background: "#8A857D" }} />
            Video
          </div>
        </div>
        <div className="ed-tl-tracks">
          <div className="ed-tl-ruler">
            {ticks.map((t) => (
              <span key={t}>{t}s</span>
            ))}
          </div>
          <div className="ed-tl-caps" role="list">
            {segments.slice(0, 48).map((s, i) => {
              const label = (s.text || "…").trim().slice(0, 18) || "Caption";
              return (
                <button
                  key={`${s.start}-${i}`}
                  type="button"
                  role="listitem"
                  className={`ed-tl-pill${i === activeIdx ? " is-active" : ""}`}
                  title={s.text}
                  onClick={() => onSeek(s.start + 0.01)}
                >
                  {label}
                  {s.text && s.text.length > 18 ? "…" : ""}
                </button>
              );
            })}
          </div>
          <div
            className="ed-tl-video"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(currentTime)}
            tabIndex={0}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = (e.clientX - rect.left) / Math.max(1, rect.width);
              onSeek(x * dur);
            }}
            onKeyDown={(e) => {
              if (!videoRef.current) return;
              if (e.key === "ArrowRight") onSeek(Math.min(dur, currentTime + 1));
              if (e.key === "ArrowLeft") onSeek(Math.max(0, currentTime - 1));
            }}
          >
            <i style={{ width: `${pct}%` }} />
            <b style={{ left: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export { formatTime };
