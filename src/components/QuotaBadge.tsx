"use client";

import { useEffect, useState } from "react";

type Usage = {
  plan: string;
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
  stripeEnabled: boolean;
};

export function QuotaBadge() {
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    void fetch("/api/billing/usage")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as Usage;
      })
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});
  }, []);

  if (!usage) return null;

  const pct = Math.min(
    100,
    Math.round((usage.usedMinutes / Math.max(1, usage.monthlyMinutes)) * 100),
  );

  return (
    <span
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--ink-2)",
      }}
      title="Minutes used this month"
    >
      <span className="font-medium" style={{ color: "var(--ink)" }}>
        {usage.planLabel}
      </span>
      <span className="tabular-nums" style={{ color: "var(--ink-3)" }}>
        {usage.usedMinutes}/{usage.monthlyMinutes} min
      </span>
      <span
        className="h-1.5 w-12 overflow-hidden rounded-full"
        style={{ background: "var(--bg)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: pct >= 90 ? "var(--warn)" : "var(--accent)",
          }}
        />
      </span>
    </span>
  );
}
