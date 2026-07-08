"use client";

import { useCallback, useEffect, useState } from "react";
import type { SpellRule } from "@/lib/spelling";

// Manage the user's custom spelling dictionary (persistent word corrections) and apply it
// to the current transcript on demand. New transcripts are corrected automatically by the
// processor; this panel fixes the one already on screen and lets the user grow the list.

interface Rule extends SpellRule {
  id: string;
}

export function DictionaryPanel({
  onApply,
}: {
  /** Run the given rules over the current transcript (client-side). */
  onApply: (rules: SpellRule[]) => void;
}) {
  const [rules, setRules] = useState<Rule[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/spelling");
    if (res.ok) {
      const data = (await res.json()) as { rules: Rule[] };
      setRules(data.rules);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const add = async () => {
    const f = from.trim();
    const t = to.trim();
    if (!f || !t || busy) return;
    setBusy(true);
    const res = await fetch("/api/spelling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: f, to: t }),
    });
    if (res.ok) {
      const { rule } = (await res.json()) as { rule: Rule };
      setRules((prev) => [...prev.filter((r) => r.from !== rule.from), rule]);
      setFrom("");
      setTo("");
    }
    setBusy(false);
  };

  const remove = async (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/spelling?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  };

  return (
    <div className="rounded-xl border border-white/10 bg-neutral-900 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Spelling dictionary
        </h3>
        {rules.length > 0 && (
          <button
            type="button"
            onClick={() => onApply(rules)}
            className="rounded-md bg-sky-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-sky-500"
          >
            Apply to captions
          </button>
        )}
      </div>

      <p className="mb-3 text-[11px] leading-relaxed text-neutral-500">
        Fix words the transcriber gets wrong (names, places, brands). Saved corrections are
        applied automatically to future videos.
      </p>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          placeholder="heard as"
          className="w-0 flex-1 rounded-md border border-white/10 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600"
        />
        <span className="text-neutral-600">→</span>
        <input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="correct to"
          className="w-0 flex-1 rounded-md border border-white/10 bg-neutral-800 px-2 py-1.5 text-sm text-neutral-100 placeholder:text-neutral-600"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy || !from.trim() || !to.trim()}
          className="rounded-md border border-white/10 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-700 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {loaded && rules.length === 0 && (
        <p className="text-xs text-neutral-600">No corrections yet.</p>
      )}
      <ul className="space-y-1">
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex items-center justify-between rounded-md bg-neutral-800/60 px-2.5 py-1.5 text-sm"
          >
            <span className="truncate text-neutral-300">
              <span className="text-neutral-500 line-through">{r.from}</span>
              <span className="mx-1.5 text-neutral-600">→</span>
              <span className="text-neutral-100">{r.to}</span>
            </span>
            <button
              type="button"
              onClick={() => remove(r.id)}
              className="ml-2 shrink-0 text-neutral-500 hover:text-red-400"
              aria-label={`Remove ${r.from}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
