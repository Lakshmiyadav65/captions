"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { ConsoleThemeToggle } from "@/components/console/ConsoleThemeToggle";
import { usePathname, useSearchParams } from "next/navigation";
import { CREDITS_CHANGED_EVENT, formatAvailableMinutes } from "@/lib/credits-display";

export type ConsoleUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

type Usage = {
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
  prepaidMinutes?: number;
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

function NavIcon({
  name,
}: {
  name: "projects" | "editor" | "plan" | "settings";
}) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (name === "projects") {
    return (
      <svg {...common}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "editor") {
    return (
      <svg {...common}>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
      </svg>
    );
  }
  if (name === "plan") {
    return (
      <svg {...common}>
        <path d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9 7.2 18l.9-5.4L4.2 8.7l5.4-.8L12 3z" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
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
    const load = () =>
      fetch("/api/billing/usage")
        .then(async (res) => (res.ok ? ((await res.json()) as Usage) : null))
        .then((data) => {
          if (data) setUsage(data);
        })
        .catch(() => {});
    void load();
    const onCredits = () => void load();
    window.addEventListener(CREDITS_CHANGED_EVENT, onCredits);
    return () => window.removeEventListener(CREDITS_CHANGED_EVENT, onCredits);
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
          <span className="tc-side-ico" aria-hidden>
            <NavIcon name="projects" />
          </span>
          Projects
        </Link>
        <Link href={editorHref} aria-current={isEditor ? "page" : undefined}>
          <span className="tc-side-ico" aria-hidden>
            <NavIcon name="editor" />
          </span>
          Editor
        </Link>
        <Link href="/billing" aria-current={isPlan ? "page" : undefined}>
          <span className="tc-side-ico" aria-hidden>
            <NavIcon name="plan" />
          </span>
          Plan
        </Link>
        <Link
          href="/billing?tab=settings"
          aria-current={isSettings ? "page" : undefined}
        >
          <span className="tc-side-ico" aria-hidden>
            <NavIcon name="settings" />
          </span>
          Settings
        </Link>
      </nav>

      <div className="tc-side-foot">
        <div className="tc-side-usage">
          {usage ? (
            <div className="tc-side-meter">
              <div className="tc-side-meter-row">
                <b>Caption Minutes</b>
                <span className="mono">
                  {formatAvailableMinutes(usage.prepaidMinutes ?? 0)}
                </span>
              </div>
              <div className="tc-side-meter-row tc-side-meter-row--muted">
                Never expires
              </div>
              <div className="tc-side-meter-row" style={{ marginTop: 8 }}>
                <b>{usage.planLabel}</b>
                <span className="mono">
                  {usage.usedMinutes}
                  <em>/{usage.monthlyMinutes} min</em>
                </span>
              </div>
              <div
                className="tc-side-bar"
                role="progressbar"
                aria-valuenow={minutesPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Minutes used"
              >
                <i style={{ width: `${minutesPct}%` }} />
              </div>
            </div>
          ) : (
            <div className="tc-side-meter-row tc-side-meter-row--muted">
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
      </div>
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
