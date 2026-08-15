"use client";

import { useEffect, useState } from "react";
import { CREDITS_CHANGED_EVENT, formatAvailableMinutes } from "@/lib/credits-display";

type Usage = {
  plan: string;
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
  prepaidMinutes?: number;
  stripeEnabled: boolean;
};

export function QuotaBadge() {
  const [usage, setUsage] = useState<Usage | null>(null);

  const load = () =>
    fetch("/api/billing/usage")
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as Usage;
      })
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});

  useEffect(() => {
    void load();
    const onCredits = () => void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, onCredits);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onCredits);
  }, []);

  if (!usage) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
        style={{
          border: "1px solid var(--line)",
          background: "var(--surface)",
          color: "var(--ink-4)",
        }}
      >
        Loading minutes…
      </span>
    );
  }

  const prepaid = usage.prepaidMinutes ?? 0;

  return (
    <span
      className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px]"
      style={{
        border: "1px solid var(--line)",
        background: "var(--surface)",
        color: "var(--ink-2)",
      }}
      title="Caption minutes — never expire"
    >
      <span className="font-medium" style={{ color: "var(--ink)" }}>
        {formatAvailableMinutes(prepaid)}
      </span>
    </span>
  );
}
