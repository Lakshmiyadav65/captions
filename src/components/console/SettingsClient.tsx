"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PLANS, type PlanId } from "@/lib/plans";
import { AppShell, type ConsoleUser } from "@/components/console/AppShell";

type Usage = {
  plan: PlanId;
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
  maxActiveJobs: number;
  stripeEnabled: boolean;
};

export function SettingsClient({ user }: { user: ConsoleUser | null }) {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
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
    <AppShell section="settings" user={user} title="Settings">
      <div className="tc-pane-scroll">
        <div className="tc-set">
          <h1>Settings</h1>
          {error ? (
            <p
              className="tc-card-plain"
              style={{
                padding: 12,
                marginBottom: 16,
                borderColor: "rgba(232,179,65,.35)",
                color: "var(--warn)",
              }}
            >
              {error}
            </p>
          ) : null}

          <div className="tc-set-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
              <div className="tc-card-plain">
                <div className="tc-row">
                  <span>
                    <b>Account</b>
                    <span>{user?.email ?? user?.name ?? "Signed in"}</span>
                  </span>
                  <Link href="/" className="tc-btn tc-btn--sm">
                    Marketing site
                  </Link>
                </div>
                <div className="tc-row">
                  <span>
                    <b>Current plan</b>
                    <span>
                      {usage
                        ? `${usage.planLabel} · ${usage.usedMinutes}/${usage.monthlyMinutes} min this month`
                        : "Loading…"}
                    </span>
                  </span>
                  {usage && usage.plan !== "free" && usage.stripeEnabled ? (
                    <button
                      type="button"
                      className="tc-btn tc-btn--sm"
                      onClick={() => void portal()}
                      disabled={busy !== null}
                    >
                      Manage billing
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="tc-card-plain">
                <div className="tc-row">
                  <span>
                    <b>Plans</b>
                    <span>Free for getting started. Upgrade when you need more minutes.</span>
                  </span>
                </div>
                {(Object.keys(PLANS) as PlanId[]).map((id) => {
                  const p = PLANS[id];
                  const current = usage?.plan === id;
                  const minutes =
                    id === "free"
                      ? (usage?.monthlyMinutes ?? p.monthlyMinutes)
                      : p.monthlyMinutes;
                  return (
                    <div className="tc-row" key={id}>
                      <span>
                        <b>
                          {p.label}
                          {current ? " · current" : ""}
                        </b>
                        <span>
                          {minutes} min/mo · up to {p.maxActiveJobs} videos at once
                        </span>
                      </span>
                      {id === "free" ? (
                        <span className="mono" style={{ color: "var(--ink-3)", fontSize: 12 }}>
                          Included
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={`tc-btn tc-btn--sm${current ? "" : " tc-btn--primary"}`}
                          disabled={!usage?.stripeEnabled || current || busy !== null}
                          onClick={() => void checkout(id)}
                        >
                          {current
                            ? "Current"
                            : busy === id
                              ? "Redirecting…"
                              : usage?.stripeEnabled
                                ? "Upgrade"
                                : "Stripe off"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="tc-card-plain" style={{ padding: 16 }}>
              <b style={{ display: "block", marginBottom: 8 }}>Tips</b>
              <p
                style={{
                  margin: 0,
                  color: "var(--ink-3)",
                  fontSize: "0.8125rem",
                  lineHeight: 1.5,
                }}
              >
                Upload from the Library command bar or the landing page. Open any project to edit
                captions, pick a style, and export a burned MP4.
              </p>
              <Link
                href="/library"
                className="tc-btn tc-btn--primary tc-btn--sm"
                style={{ marginTop: 14 }}
              >
                Back to Library
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
