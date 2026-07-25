"use client";

import { useEffect, useState } from "react";
import { PLANS, type PlanId } from "@/lib/plans";

type Usage = {
  plan: PlanId;
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
  maxActiveJobs: number;
  stripeEnabled: boolean;
};

export default function BillingPage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    void fetch("/api/billing/usage")
      .then(async (res) => {
        if (res.status === 401) {
          setError("Sign in to view billing.");
          return null;
        }
        if (!res.ok) throw new Error("Could not load usage");
        return (await res.json()) as Usage;
      })
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed"));
  };

  useEffect(() => {
    load();
  }, []);

  const checkout = async (plan: "creator" | "pro") => {
    setBusy(plan);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  };

  const portal = async () => {
    setBusy("portal");
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Portal failed");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Portal failed");
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <a href="/" className="text-sm text-sky-400 hover:text-sky-300">
        ← Home
      </a>
      <h1 className="mt-4 text-2xl font-semibold text-white">Billing</h1>
      <p className="mt-2 text-sm text-neutral-400">
        Free for getting started. Upgrade when you need more transcription minutes.
      </p>

      {error && (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {error}
        </p>
      )}

      {usage && (
        <div className="mt-6 rounded-xl border border-white/10 bg-neutral-900 p-4">
          <p className="text-sm text-neutral-300">
            Current plan:{" "}
            <span className="font-semibold text-white">{usage.planLabel}</span>
          </p>
          <p className="mt-1 text-sm tabular-nums text-neutral-400">
            {usage.usedMinutes} / {usage.monthlyMinutes} minutes used this month
          </p>
          {usage.plan !== "free" && usage.stripeEnabled && (
            <button
              type="button"
              onClick={() => void portal()}
              disabled={busy !== null}
              className="mt-3 text-sm text-sky-400 hover:text-sky-300 disabled:opacity-50"
            >
              Manage subscription
            </button>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {(Object.keys(PLANS) as PlanId[]).map((id) => {
          const p = PLANS[id];
          const current = usage?.plan === id;
          const minutes =
            id === "free" ? usage?.monthlyMinutes ?? p.monthlyMinutes : p.monthlyMinutes;
          return (
            <div
              key={id}
              className={`rounded-xl border p-4 ${
                current ? "border-sky-500/50 bg-sky-500/5" : "border-white/10 bg-neutral-900"
              }`}
            >
              <h2 className="font-semibold text-white">{p.label}</h2>
              <p className="mt-2 text-2xl font-semibold tabular-nums text-white">
                {minutes}
                <span className="text-sm font-normal text-neutral-500"> min/mo</span>
              </p>
              <p className="mt-1 text-xs text-neutral-500">
                Up to {p.maxActiveJobs} videos processing at once
              </p>
              {id === "free" ? (
                <p className="mt-4 text-xs text-neutral-500">
                  {current ? "Your current plan" : "Included"}
                </p>
              ) : (
                <button
                  type="button"
                  disabled={!usage?.stripeEnabled || current || busy !== null}
                  onClick={() => void checkout(id)}
                  className="mt-4 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {current
                    ? "Current"
                    : busy === id
                      ? "Redirecting…"
                      : usage?.stripeEnabled
                        ? `Upgrade to ${p.label}`
                        : "Stripe not configured"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
