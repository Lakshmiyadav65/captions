"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fontStack } from "@/lib/fonts";
import {
  mergeWithNext,
  splitSegment,
  stripFillers,
} from "@/lib/transcript-edit";
import type { Segment } from "@/lib/transcription/types";

// Editable transcript. When the user finishes editing a line (blur), onTextCommit
// fires so the parent can auto-learn word corrections into memory — no Listener panel.
// While the video plays, the active line auto-scrolls into view (paused briefly if the
// user scrolls or edits manually). Power-edit: strip fillers, split/merge, keyboard nav.

function fmt(t: number): string {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

function scrollRowIntoPanel(row: HTMLElement) {
  let parent: HTMLElement | null = row.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const canScroll =
      /(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1;
    if (canScroll) break;
    parent = parent.parentElement;
  }

  if (parent) {
    const parentRect = parent.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const pad = 12;
    if (rowRect.top < parentRect.top + pad) {
      parent.scrollBy({ top: rowRect.top - parentRect.top - pad, behavior: "smooth" });
    } else if (rowRect.bottom > parentRect.bottom - pad) {
      parent.scrollBy({ top: rowRect.bottom - parentRect.bottom + pad, behavior: "smooth" });
    }
  } else {
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

function isTypingTarget(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLInputElement ||
    (el instanceof HTMLElement && el.isContentEditable)
  );
}

export function SubtitleList({
  segments,
  onChange,
  currentTime,
  onSeek,
  onTextCommit,
}: {
  segments: Segment[];
  onChange: (segments: Segment[]) => void;
  currentTime: number;
  onSeek: (t: number) => void;
  /** Fired when the user leaves a caption line after editing (blur). */
  onTextCommit?: (index: number, text: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);
  const lastActiveRef = useRef(-1);
  /** Epoch ms — skip auto-follow until then (user is scrolling / editing). */
  const pauseUntilRef = useRef(0);
  const [following, setFollowing] = useState(true);
  /** Manual focus for keyboard ops when playhead isn't on a line. */
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const activeIndex = segments.findIndex(
    (s) => currentTime >= s.start && currentTime < s.end,
  );
  const focusIndex = selectedIndex ?? (activeIndex >= 0 ? activeIndex : 0);

  const pauseFollow = (ms = 4000) => {
    pauseUntilRef.current = Date.now() + ms;
    setFollowing(false);
  };

  const tryScrollActive = useCallback(() => {
    const row = activeRef.current;
    if (!row) return;

    const root = rootRef.current;
    const focused = document.activeElement;
    if (
      root &&
      focused &&
      root.contains(focused) &&
      (focused instanceof HTMLTextAreaElement || focused instanceof HTMLInputElement)
    ) {
      return;
    }

    scrollRowIntoPanel(row);
  }, []);

  const resumeFollow = () => {
    pauseUntilRef.current = 0;
    setFollowing(true);
    requestAnimationFrame(() => tryScrollActive());
  };

  // Keep the spoken line in view as the playhead moves.
  useEffect(() => {
    if (activeIndex < 0) return;
    if (activeIndex === lastActiveRef.current) return;
    lastActiveRef.current = activeIndex;
    setSelectedIndex(activeIndex);

    if (Date.now() < pauseUntilRef.current) return;

    setFollowing(true);
    requestAnimationFrame(() => tryScrollActive());
  }, [activeIndex, tryScrollActive]);

  // After a manual-scroll pause, resume following automatically.
  useEffect(() => {
    if (following) return;
    const id = window.setInterval(() => {
      if (Date.now() >= pauseUntilRef.current) {
        setFollowing(true);
        tryScrollActive();
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [following, tryScrollActive]);

  const update = (i: number, patch: Partial<Segment>) =>
    onChange(segments.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(segments.filter((_, j) => j !== i));

  const addAfter = (i: number) => {
    const prev = segments[i];
    const start = prev ? prev.end : 0;
    const next: Segment = { start, end: start + 2, text: "" };
    onChange([...segments.slice(0, i + 1), next, ...segments.slice(i + 1)]);
  };

  const doSplit = (i: number) => {
    const next = splitSegment(segments, i);
    if (next === segments) return;
    onChange(next);
    setSelectedIndex(i);
  };

  const doMerge = (i: number) => {
    const next = mergeWithNext(segments, i);
    if (next === segments) return;
    onChange(next);
    setSelectedIndex(i);
  };

  const doStripFillers = () => {
    const next = stripFillers(segments);
    if (next.length === segments.length && next.every((s, i) => s.text === segments[i].text)) {
      return;
    }
    onChange(next);
  };

  // Keyboard: j/k navigate, s split, m merge, f strip fillers (when not typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const root = rootRef.current;
      if (!root) return;
      // Only when focus is inside the transcript panel (or nowhere specific on page body).
      const t = e.target as Node | null;
      if (t && !root.contains(t) && t !== document.body && !(t instanceof Document)) {
        // Allow shortcuts when focus is on the scroll container parent
        const aside = root.closest("[data-transcript-panel]");
        if (aside && t instanceof Node && aside.contains(t)) {
          // ok
        } else if (!document.activeElement || document.activeElement === document.body) {
          // ok — global when idle
        } else {
          return;
        }
      }

      const key = e.key.toLowerCase();
      if (key === "j" || key === "arrowdown") {
        e.preventDefault();
        const i = Math.min(segments.length - 1, focusIndex + 1);
        setSelectedIndex(i);
        pauseFollow();
        const seg = segments[i];
        if (seg) onSeek(seg.start);
        return;
      }
      if (key === "k" || key === "arrowup") {
        e.preventDefault();
        const i = Math.max(0, focusIndex - 1);
        setSelectedIndex(i);
        pauseFollow();
        const seg = segments[i];
        if (seg) onSeek(seg.start);
        return;
      }
      if (key === "s") {
        e.preventDefault();
        doSplit(focusIndex);
        return;
      }
      if (key === "m") {
        e.preventDefault();
        doMerge(focusIndex);
        return;
      }
      if (key === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        doStripFillers();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, focusIndex, onSeek, onChange]);

  return (
    <div
      ref={rootRef}
      data-transcript-panel
      className="space-y-2"
      onWheel={() => pauseFollow()}
      onTouchMove={() => pauseFollow()}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Transcript · {segments.length} lines
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={doStripFillers}
            className="rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300 hover:bg-neutral-700"
            title="Remove um / uh / ante / you know (F)"
          >
            Strip fillers
          </button>
          {!following && (
            <button
              type="button"
              onClick={resumeFollow}
              className="text-[11px] text-sky-400 hover:text-sky-300"
              title="Scroll the transcript with the video again"
            >
              Follow playback
            </button>
          )}
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
      </div>
      <p className="text-[10px] text-neutral-600">
        Keys: J/K next·prev · S split · M merge · F strip fillers
      </p>

      <ol className="space-y-1.5">
        {segments.map((s, i) => {
          const active = i === activeIndex;
          const selected = i === focusIndex;
          return (
            <li
              key={i}
              ref={active || selected ? activeRef : undefined}
              data-active={active || undefined}
              onClick={() => setSelectedIndex(i)}
              className={`rounded-lg border p-2.5 transition ${
                active
                  ? "border-sky-500/60 bg-sky-500/10"
                  : selected
                    ? "border-white/25 bg-neutral-900"
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
                  onFocus={() => pauseFollow(8000)}
                  onBlur={() => onTextCommit?.(i, segments[i].text)}
                  className="w-16 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-200 outline-none focus:ring-1 focus:ring-sky-500"
                  aria-label="Start time (seconds)"
                />
                <input
                  type="number"
                  step={0.1}
                  value={s.end.toFixed(1)}
                  onChange={(e) => update(i, { end: parseFloat(e.target.value) || 0 })}
                  onFocus={() => pauseFollow(8000)}
                  onBlur={() => onTextCommit?.(i, segments[i].text)}
                  className="w-16 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-neutral-200 outline-none focus:ring-1 focus:ring-sky-500"
                  aria-label="End time (seconds)"
                />
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => doSplit(i)}
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
                    title="Split line (S)"
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    onClick={() => doMerge(i)}
                    disabled={i >= segments.length - 1}
                    className="rounded px-1.5 py-0.5 text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-30"
                    title="Merge with next (M)"
                  >
                    Merge
                  </button>
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
                onFocus={() => {
                  pauseFollow(8000);
                  setSelectedIndex(i);
                }}
                onBlur={(e) => onTextCommit?.(i, e.target.value)}
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
