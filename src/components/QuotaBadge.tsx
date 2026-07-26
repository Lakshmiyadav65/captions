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
      className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-300"
      title="Minutes used this month"
    >
      <span className="font-medium text-neutral-200">{usage.planLabel}</span>
      <span className="tabular-nums text-neutral-500">
        {usage.usedMinutes}/{usage.monthlyMinutes} min
      </span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-800">
        <span
          className={`block h-full rounded-full ${pct >= 90 ? "bg-amber-500" : "bg-sky-500"}`}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
