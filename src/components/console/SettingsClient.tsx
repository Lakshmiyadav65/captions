"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PLANS, type PlanId } from "@/lib/plans";
import { AppShell, type ConsoleUser } from "@/components/console/AppShell";

type Usage = {
  plan: PlanId;
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
  prepaidMinutes?: number;
  maxActiveJobs: number;
  stripeEnabled: boolean;
};

type Txn = {
  id: string;
  type: string;
  minutes: number;
  description: string | null;
  created_at: string;
  status: string;
};

const PREPAID_PACKS = [
  {
    id: "minutes_5" as const,
    name: "5 Minutes",
    description: "Perfect for trying captions without a subscription.",
    button: "Buy 5 Minutes",
  },
  {
    id: "minutes_10" as const,
    name: "10 Minutes",
    description: "More minutes for your next batch of videos.",
    button: "Buy 10 Minutes",
    recommended: true,
  },
];

export function SettingsClient({ user }: { user: ConsoleUser | null }) {
  const searchParams = useSearchParams();
  const isSettingsTab = searchParams.get("tab") === "settings";
  const creditsStatus = searchParams.get("credits");
  const buyPack = searchParams.get("buy");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const buyOnce = useRef(false);

  const refreshUsage = () =>
    fetch("/api/billing/usage")
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
      });

  useEffect(() => {
    void refreshUsage().catch((e) => setError(e instanceof Error ? e.message : "Failed"));
    void fetch("/api/credits/transactions")
      .then(async (res) => (res.ok ? ((await res.json()) as { transactions: Txn[] }) : null))
      .then((data) => {
        if (data?.transactions) setTxns(data.transactions);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (creditsStatus === "canceled") {
      setError("Payment Failed. Your payment wasn't completed. No minutes were added.");
      return;
    }
    if (creditsStatus !== "success") return;

    let cancelled = false;
    setNotice("Your payment is being verified. Your minutes will appear shortly.");

    const poll = async () => {
      let latest = 0;
      for (let i = 0; i < 8; i++) {
        try {
          const res = await fetch("/api/credits/balance");
          if (res.ok) {
            const data = (await res.json()) as { available_minutes?: number };
            latest = Number(data.available_minutes ?? 0);
          }
          await refreshUsage();
        } catch {
          /* webhook may still be in flight */
        }
        if (cancelled) return;
        if (latest > 0 || i >= 2) {
          setNotice(
            `Minutes Added! Your caption minutes are ready to use. ${latest} minutes available`,
          );
          void fetch("/api/credits/transactions")
            .then(async (res) =>
              res.ok ? ((await res.json()) as { transactions: Txn[] }) : null,
            )
            .then((data) => {
              if (data?.transactions) setTxns(data.transactions);
            })
            .catch(() => {});
          if (latest > 0) return;
        }
        await new Promise((r) => window.setTimeout(r, 1500));
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [creditsStatus]);

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

  const buyMinutes = async (packId: "minutes_5" | "minutes_10") => {
    setBusy(packId);
    setError(null);
    try {
      const res = await fetch("/api/credits/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setNotice(null);
      setError(e instanceof Error ? e.message : "Checkout failed");
      setBusy(null);
    }
  };

  useEffect(() => {
    if (buyOnce.current) return;
    if (buyPack === "minutes_5" || buyPack === "minutes_10") {
      buyOnce.current = true;
      void buyMinutes(buyPack);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyPack]);

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

  const prepaid = usage?.prepaidMinutes ?? 0;

  return (
    <AppShell
      section="settings"
      user={user}
      title={isSettingsTab ? "Settings" : "Plan"}
    >
      <div className="tc-pane-scroll">
        <div className="tc-set">
          <div className="tc-set-intro">
            <h1>{isSettingsTab ? "Settings" : "Plan"}</h1>
            <p>
              {isSettingsTab
                ? "Defaults apply to every new project. Export and plan live here."
                : "Free for getting started. Buy prepaid minutes or upgrade when you need more."}
            </p>
          </div>

          {notice ? (
            <p className="tc-card-plain" style={{ padding: 12, marginBottom: 16, color: "var(--ok)" }}>
              {notice}
            </p>
          ) : null}

          {error ? (
            <p
              className="tc-card-plain"
              style={{
                padding: 12,
                marginBottom: 16,
                borderColor: "var(--warn-line, rgba(232,179,65,.35))",
                color: "var(--warn)",
              }}
            >
              {error}
            </p>
          ) : null}

          <div className="tc-set-grid">
            <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
              <div className="tc-card-plain">
                <div className="tc-card-head">
                  <b>Account</b>
                  <span>Signed-in identity and current plan</span>
                </div>
                <div className="tc-row">
                  <span>
                    <b>Email</b>
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
                <div className="tc-row">
                  <span>
                    <b>Caption Minutes</b>
                    <span>
                      {usage
                        ? prepaid > 0
                          ? `${prepaid} min available · Never expires`
                          : "You're out of caption minutes."
                        : "Loading…"}
                    </span>
                  </span>
                  <a href="#prepaid" className="tc-btn tc-btn--primary tc-btn--sm">
                    {prepaid > 0 ? "Buy More Minutes" : "Buy Minutes"}
                  </a>
                </div>
              </div>

              <div className="tc-card-plain" id="prepaid">
                <div className="tc-card-head">
                  <b>Prepaid Minutes</b>
                  <span>Buy minutes once. Use them whenever you need.</span>
                </div>
                {PREPAID_PACKS.map((pack) => (
                  <div className="tc-row" key={pack.id}>
                    <span>
                      <b>
                        {pack.name}
                        {pack.recommended ? " · BEST VALUE" : ""}
                      </b>
                      <span>{pack.description}</span>
                    </span>
                    <button
                      type="button"
                      className={`tc-btn tc-btn--sm${pack.recommended ? " tc-btn--primary" : ""}`}
                      disabled={!usage?.stripeEnabled || busy !== null}
                      onClick={() => void buyMinutes(pack.id)}
                    >
                      {busy === pack.id
                        ? "Redirecting…"
                        : usage?.stripeEnabled
                          ? pack.button
                          : "Stripe off"}
                    </button>
                  </div>
                ))}
              </div>

              <div className="tc-card-plain">
                <div className="tc-card-head">
                  <b>Plan</b>
                  <span>Free for getting started. Upgrade when you need more minutes.</span>
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
                        <span className="mono" style={{ color: "var(--ink-4)", fontSize: 12 }}>
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

              {txns.length > 0 ? (
                <div className="tc-card-plain">
                  <div className="tc-card-head">
                    <b>Minute history</b>
                    <span>Purchases and usage on your prepaid balance</span>
                  </div>
                  {txns.slice(0, 12).map((t) => (
                    <div className="tc-row" key={t.id}>
                      <span>
                        <b>{t.type}</b>
                        <span>{t.description ?? t.status}</span>
                      </span>
                      <span
                        className="mono"
                        style={{ color: t.minutes >= 0 ? "var(--ok)" : "var(--ink-2)" }}
                      >
                        {t.minutes > 0 ? "+" : ""}
                        {t.minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="tc-card-plain" style={{ padding: 18 }}>
              <b
                style={{
                  display: "block",
                  marginBottom: 8,
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--ink-4)",
                }}
              >
                Tips
              </b>
              <p
                style={{
                  margin: 0,
                  color: "var(--ink-3)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                Prepaid minutes never expire. Monthly plan minutes still apply first; extra
                processing uses your prepaid balance.
              </p>
              <Link
                href="/library"
                className="tc-btn tc-btn--primary tc-btn--sm"
                style={{ marginTop: 14 }}
              >
                Back to Projects
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
