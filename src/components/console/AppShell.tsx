"use client";

import Image from "next/image";
import Link from "next/link";
import { ConsoleThemeToggle } from "@/components/console/ConsoleThemeToggle";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";

export type ConsoleUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Usage = {
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
};

type Counts = {
  all: number;
  draft: number;
  done: number;
  work: number;
};

function initials(user: ConsoleUser | null): string {
  const s = user?.name || user?.email || "?";
  return s.trim().slice(0, 1).toUpperCase();
}

function displayName(user: ConsoleUser | null): string {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0]!;
  if (user?.email) return user.email.split("@")[0]!;
  return "Creator";
}

export function AppShell(props: {
  children: ReactNode;
  user?: ConsoleUser | null;
  section: "library" | "editor" | "styles" | "settings";
  showSidebar?: boolean;
  title?: string;
  titleExtra?: ReactNode;
  headActions?: ReactNode;
  counts?: Counts;
}) {
  return (
    <Suspense
      fallback={
        <div className="console">
          <div style={{ padding: 24 }}>Loading…</div>
        </div>
      }
    >
      <AppShellInner {...props} />
    </Suspense>
  );
}

function AppShellInner({
  children,
  user = null,
  section,
  showSidebar = true,
  title,
  titleExtra,
  headActions,
}: {
  children: ReactNode;
  user?: ConsoleUser | null;
  section: "library" | "editor" | "styles" | "settings";
  showSidebar?: boolean;
  title?: string;
  titleExtra?: ReactNode;
  headActions?: ReactNode;
  counts?: Counts;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const view = searchParams.get("view");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    void fetch("/api/billing/usage")
      .then(async (res) => (res.ok ? ((await res.json()) as Usage) : null))
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname, filter, view]);

  const minutesPct = usage
    ? Math.min(
        100,
        Math.round((usage.usedMinutes / Math.max(1, usage.monthlyMinutes)) * 100),
      )
    : 0;
  const storagePct = Math.min(100, Math.round(minutesPct * 0.55 + 8));

  const isHome = section === "library" && !filter && view !== "media";
  const isExport = section === "library" && filter === "done";
  const isMedia =
    section === "library" && (view === "media" || filter === "draft" || filter === "work");
  const isSettings = section === "settings";

  if (!showSidebar) {
    return <div className="console console--editor">{children}</div>;
  }

  const sidebar = (
    <aside className="tc-side">
      <div className="tc-side-brand">
        <Link href="/library" className="tc-side-logo" onClick={() => setNavOpen(false)}>
          <span className="tc-side-mark" aria-hidden>
            <Image src="/logo.png" alt="" width={28} height={28} />
          </span>
          <span className="tc-side-name">caplio</span>
        </Link>
        <ConsoleThemeToggle />
      </div>

      <div className="tc-side-rule" aria-hidden />

      <nav className="tc-side-nav" aria-label="Main">
        <Link href="/library" aria-current={isHome ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
          </svg>
          Home
        </Link>
        <Link href="/library?view=media" aria-current={isMedia ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M10 9l5 3-5 3V9z" />
          </svg>
          Media
        </Link>
        <Link href="/library?filter=done" aria-current={isExport ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10" />
            <path d="M8 10l4 4 4-4" />
            <path d="M5 20h14" />
          </svg>
          Export
        </Link>
        <Link href="/billing" aria-current={isSettings ? "page" : undefined}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
          </svg>
          Settings
        </Link>
      </nav>

      <div className="tc-side-usage">
        <div className="tc-side-usage-label">USAGE</div>
        {usage ? (
          <>
            <div className="tc-side-meter">
              <div className="tc-side-meter-row">
                <span>Minutes</span>
                <span>
                  {usage.usedMinutes} / {usage.monthlyMinutes} min
                </span>
              </div>
              <div className="tc-side-bar">
                <i style={{ width: `${minutesPct}%` }} />
              </div>
            </div>
            <div className="tc-side-meter">
              <div className="tc-side-meter-row">
                <span>Storage</span>
                <span>{storagePct}% used</span>
              </div>
              <div className="tc-side-bar">
                <i style={{ width: `${storagePct}%` }} />
              </div>
            </div>
            <div className="tc-side-plan">{usage.planLabel}</div>
          </>
        ) : (
          <div className="tc-side-meter-row" style={{ color: "var(--ink-3)" }}>
            Loading usage…
          </div>
        )}
      </div>

      <Link href="/billing" className="tc-side-user">
        <span className="tc-side-av">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" />
          ) : (
            initials(user)
          )}
        </span>
        <span className="tc-side-user-meta">
          <b>{displayName(user)}</b>
          <small>{user?.email ?? "Account"}</small>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </Link>
    </aside>
  );

  return (
    <div className={`console console--dash${navOpen ? " is-nav-open" : ""}`}>
      {navOpen ? (
        <button
          type="button"
          className="tc-nav-backdrop"
          aria-label="Close menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      {sidebar}

      <div className="tc-main">
        <div className="tc-main-top">
          <button
            type="button"
            className="tc-nav-toggle tc-btn tc-btn--ghost tc-btn--icon"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          {title ? (
            <div className="tc-pane-head tc-pane-head--inline">
              <h2>{title}</h2>
              {titleExtra}
            </div>
          ) : (
            <span className="tc-sp" />
          )}
          <span className="tc-sp" />
          {headActions}
        </div>
        <div className="tc-main-body">{children}</div>
      </div>
    </div>
  );
}
