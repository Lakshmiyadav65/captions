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
  headSearch?: ReactNode;
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
  headSearch,
}: {
  children: ReactNode;
  user?: ConsoleUser | null;
  section: "library" | "editor" | "styles" | "settings";
  showSidebar?: boolean;
  title?: string;
  titleExtra?: ReactNode;
  headActions?: ReactNode;
  headSearch?: ReactNode;
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

  const minutesLeft = usage
    ? Math.max(0, usage.monthlyMinutes - usage.usedMinutes)
    : 0;
  const minutesPct = usage
    ? Math.min(
        100,
        Math.round((usage.usedMinutes / Math.max(1, usage.monthlyMinutes)) * 100),
      )
    : 0;

  const isHome = section === "library" && !filter && view !== "media";
  const isExport = section === "library" && filter === "done";
  const isMedia =
    section === "library" && (view === "media" || filter === "draft" || filter === "work");
  const isSettings = section === "settings";

  const topTitle =
    title ??
    (isHome
      ? "Home"
      : isExport
        ? "Export"
        : isMedia
          ? "Media"
          : isSettings
            ? "Settings"
            : undefined);

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

      <nav className="tc-side-nav" aria-label="Main">
        <Link href="/library" aria-current={isHome ? "page" : undefined}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z" />
          </svg>
          Home
        </Link>
        <Link href="/library?view=media" aria-current={isMedia ? "page" : undefined}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M10 9l5 3-5 3V9z" />
          </svg>
          Media
        </Link>
        <Link href="/library?filter=done" aria-current={isExport ? "page" : undefined}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v10" />
            <path d="M8 10l4 4 4-4" />
            <path d="M5 20h14" />
          </svg>
          Export
        </Link>
        <Link href="/billing" aria-current={isSettings ? "page" : undefined}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 3v2m0 14v2M4 12H2m20 0h-2M6.3 6.3L4.9 4.9m14.2 14.2l-1.4-1.4m1.4-12.8l-1.4 1.4M6.3 17.7l-1.4 1.4" />
          </svg>
          Settings
        </Link>
      </nav>

      <div className="tc-side-usage">
        {usage ? (
          <>
            <div className="tc-side-meter">
              <div className="tc-side-meter-row">
                <b>{usage.planLabel}</b>
                <span className="mono">{minutesLeft} min left</span>
              </div>
              <div className="tc-side-bar">
                <i style={{ width: `${minutesPct}%` }} />
              </div>
              <div className="tc-side-plan">
                {usage.usedMinutes} / {usage.monthlyMinutes} transcription minutes this month
              </div>
            </div>
            <Link href="/billing" className="tc-btn tc-btn--outline tc-btn--sm tc-side-upgrade">
              Upgrade
            </Link>
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
          <small>{usage?.planLabel ?? user?.email ?? "Account"}</small>
        </span>
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M10 4v16" />
            </svg>
          </button>
          {topTitle ? <h2>{topTitle}</h2> : null}
          {titleExtra}
          <span className="tc-sp" />
          {headSearch}
          {headActions}
        </div>
        <div className="tc-main-body">{children}</div>
      </div>
    </div>
  );
}
