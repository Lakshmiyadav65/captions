"use client";

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
  hideTopBar?: boolean;
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
  hideTopBar = false,
}: {
  children: ReactNode;
  user?: ConsoleUser | null;
  section: "library" | "editor" | "styles" | "settings";
  showSidebar?: boolean;
  title?: string;
  titleExtra?: ReactNode;
  headActions?: ReactNode;
  headSearch?: ReactNode;
  hideTopBar?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");
  const view = searchParams.get("view");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  const [editorHref, setEditorHref] = useState("/library");

  useEffect(() => {
    void fetch("/api/billing/usage")
      .then(async (res) => (res.ok ? ((await res.json()) as Usage) : null))
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    void fetch("/api/jobs")
      .then(async (res) =>
        res.ok ? ((await res.json()) as { jobs?: { id: string }[] }) : null,
      )
      .then((data) => {
        const id = data?.jobs?.[0]?.id;
        if (id) setEditorHref(`/jobs/${id}`);
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

  const isProjects = section === "library" && !filter && view !== "new";
  const isNew = section === "library" && view === "new";
  const isEditor = section === "editor";
  const isPlan = section === "settings" && searchParams.get("tab") !== "settings";
  const isSettings =
    section === "settings" && searchParams.get("tab") === "settings";

  const topTitle =
    title ??
    (isProjects
      ? "Projects"
      : isNew
        ? "New project"
        : isPlan
          ? "Plan"
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
            C
          </span>
          <span className="tc-side-brand-text">
            <span className="tc-side-name">Caplio</span>
            <span className="tc-side-tag">Telugu captions</span>
          </span>
        </Link>
        <ConsoleThemeToggle />
      </div>

      <nav className="tc-side-nav" aria-label="Main">
        <Link href="/library" aria-current={isProjects ? "page" : undefined}>
          <span className="tc-side-glyph" aria-hidden>
            ▦
          </span>
          Projects
        </Link>
        <Link href="/library?view=new" aria-current={isNew ? "page" : undefined}>
          <span className="tc-side-glyph" aria-hidden>
            +
          </span>
          New project
        </Link>
        <Link href={editorHref} aria-current={isEditor ? "page" : undefined}>
          <span className="tc-side-glyph" aria-hidden>
            ✎
          </span>
          Editor
        </Link>
        <Link href="/billing" aria-current={isPlan ? "page" : undefined}>
          <span className="tc-side-glyph" aria-hidden>
            ◈
          </span>
          Plan
        </Link>
        <Link
          href="/billing?tab=settings"
          aria-current={isSettings ? "page" : undefined}
        >
          <span className="tc-side-glyph" aria-hidden>
            ⚙
          </span>
          Settings
        </Link>
      </nav>

      <div className="tc-side-usage">
        {usage ? (
          <div className="tc-side-meter">
            <div className="tc-side-meter-row">
              <b>{usage.planLabel}</b>
              <span className="mono">
                {usage.usedMinutes}/{usage.monthlyMinutes}
              </span>
            </div>
            <div className="tc-side-bar">
              <i style={{ width: `${minutesPct}%` }} />
            </div>
            <Link href="/billing" className="tc-btn tc-btn--outline tc-btn--sm tc-side-upgrade">
              Upgrade
            </Link>
          </div>
        ) : (
          <div className="tc-side-meter-row" style={{ color: "var(--ink-3)" }}>
            Loading usage…
          </div>
        )}
      </div>

      <Link href="/billing?tab=settings" className="tc-side-user">
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
          <small>{user?.email ?? usage?.planLabel ?? "Account"}</small>
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
        {!hideTopBar ? (
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
        ) : (
          <button
            type="button"
            className="tc-nav-toggle tc-btn tc-btn--ghost tc-btn--icon tc-nav-toggle--float"
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <path d="M10 4v16" />
            </svg>
          </button>
        )}
        <div className="tc-main-body">{children}</div>
      </div>
    </div>
  );
}
