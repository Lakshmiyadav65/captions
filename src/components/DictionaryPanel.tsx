"use client";

import { useCallback, useEffect, useState } from "react";
import { applySpelling, type SpellRule } from "@/lib/spelling";
import type { Segment } from "@/lib/transcription/types";

type RuleRow = SpellRule & { id: string };

/**
 * Visible learned spelling dictionary — list, delete, and apply rules to the
 * open transcript. Complements silent auto-learn on caption blur.
 */
export function DictionaryPanel({
  segments,
  onApplySegments,
  refreshToken,
}: {
  segments: Segment[] | null;
  /** Apply corrected segments (parent persists). */
  onApplySegments: (next: Segment[]) => void;
  /** Bump when new rules are learned so the list reloads. */
  refreshToken?: number;
}) {
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [signedOut, setSignedOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/spelling");
      if (res.status === 401) {
        setSignedOut(true);
        setRules([]);
        return;
      }
      setSignedOut(false);
      if (!res.ok) throw new Error("Could not load dictionary");
      const data = (await res.json()) as { rules: RuleRow[] };
      setRules(data.rules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  const remove = async (id: string) => {
    const res = await fetch(`/api/spelling?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setError("Could not delete rule");
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const applyToTranscript = () => {
    if (!segments?.length || !rules.length) return;
    setApplying(true);
    try {
      const spellRules: SpellRule[] = rules.map(({ from, to }) => ({ from, to }));
      const next = segments.map((s) => ({
        ...s,
        text: applySpelling(s.text, spellRules),
        words: s.words?.map((w) => ({
          ...w,
          text: applySpelling(w.text, spellRules),
        })),
      }));
      onApplySegments(next);
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="mt-6 border-t border-white/10 pt-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Memory · dictionary
        </h3>
        <span className="text-[11px] text-neutral-500">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {signedOut && (
            <p className="text-xs text-amber-200/90">
              Sign in to save and manage a personal dictionary.
            </p>
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}

          {loading && !rules.length ? (
            <p className="text-xs text-neutral-500">Loading…</p>
          ) : !signedOut && rules.length === 0 ? null : (
            <ul className="max-h-40 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
              {rules.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center gap-2 rounded-md border border-white/5 bg-neutral-800/60 px-2 py-1.5 text-xs"
                >
                  <span className="min-w-0 flex-1 truncate font-mono text-neutral-300">
                    <span className="text-neutral-500">{r.from}</span>
                    <span className="mx-1.5 text-neutral-600">→</span>
                    <span className="text-emerald-300/90">{r.to}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(r.id)}
                    className="shrink-0 rounded px-1.5 py-0.5 text-neutral-500 hover:bg-red-500/20 hover:text-red-300"
                    title="Remove rule"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!signedOut && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={applyToTranscript}
                disabled={!segments?.length || !rules.length || applying}
                className="rounded-lg border border-white/10 bg-neutral-800 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {applying ? "Applying…" : "Apply to transcript"}
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg px-2.5 py-1.5 text-[11px] text-neutral-500 hover:text-neutral-300"
              >
                Refresh
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
