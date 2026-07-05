"use client";

import { fontStack } from "@/lib/fonts";
import type { Segment } from "@/lib/transcription/types";

// Editable transcript. Telugu ASR is imperfect, so users fix wording and nudge timings
// here; every edit flows up to the parent, which drives the preview and the exports.

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

export function SubtitleList({
  segments,
  onChange,
  currentTime,
  onSeek,
}: {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  currentTime: number;
  onSeek: (t: number) => void;
}) {
  const update = (i: number, patch: Partial<Segment>) =>
    onChange(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(segments.filter((_, j) => j !== i));

  const addAfter = (i: number) => {
    const prev = segments[i];
    const start = prev ? prev.end : 0;
    const next: Segment = { start, end: start + 2, text: "" };
    onChange([...segments.slice(0, i + 1), next, ...segments.slice(i + 1)]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Transcript · {segments.length} lines
        </h3>
        {segments.length === 0 && (
          <button
            type="button"
            onClick={() => addAfter(-1)}
            className="text-xs text-sky-400 hover:text-sky-300"
          >
            + Add line
          </button>
        )}
      </div>

      <ol className="space-y-1.5">
        {segments.map((s, i) => {
          const active = currentTime >= s.start && currentTime < s.end;
          return (
            <li
              key={i}
              className={`rounded-lg border p-2.5 transition ${
                active
                  ? "border-sky-500/60 bg-sky-500/10"
                  : "border-white/5 bg-neutral-900 hover:border-white/15"
              }`}
            >
              <div className="mb-1.5 flex items-center gap-2 text-[11px] text-neutral-400">
                <button
                  type="button"
                  onClick={() => onSeek(s.start)}
                  className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-sky-300 hover:bg-neutral-700"
                  title="Jump to this line"
                >
                  {fmt(s.start)}
                </button>
                <span>→</span>
                <input
                  type="number"
                  step={0.1}
                  value={s.start.toFixed(1)}
                  onChange={(e) => update(i, { start: parseFloat(e.target.value) || 0 })}
                  className="w-16 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-200 outline-none focus:ring-1 focus:ring-sky-500"
                  aria-label="Start time (seconds)"
                />
                <input
                  type="number"
                  step={0.1}
                  value={s.end.toFixed(1)}
                  onChange={(e) => update(i, { end: parseFloat(e.target.value) || 0 })}
                  className="w-16 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-200 outline-none focus:ring-1 focus:ring-sky-500"
                  aria-label="End time (seconds)"
                />
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => addAfter(i)}
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    title="Add line below"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-red-500/20 hover:text-red-300"
                    title="Delete line"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <textarea
                value={s.text}
                lang="te"
                rows={Math.max(1, Math.ceil(s.text.length / 42))}
                onChange={(e) => update(i, { text: e.target.value })}
                style={{ fontFamily: fontStack("Noto Sans Telugu") }}
                className="w-full resize-none rounded bg-transparent text-[15px] leading-snug text-neutral-100 outline-none focus:bg-neutral-800/60"
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
