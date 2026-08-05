"use client";

import Link from "next/link";
import { ConsoleThemeToggle } from "@/components/console/ConsoleThemeToggle";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

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

export function AppShell({
  children,
  user = null,
  section,
  showSidebar = true,
  title,
  titleExtra,
  headActions,
  counts,
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
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    void fetch("/api/billing/usage")
      .then(async (res) => (res.ok ? ((await res.json()) as Usage) : null))
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});
  }, []);

  const leftMin = usage
    ? Math.max(0, usage.monthlyMinutes - usage.usedMinutes)
    : null;
  const pct = usage
    ? Math.min(
        100,
        Math.round((usage.usedMinutes / Math.max(1, usage.monthlyMinutes)) * 100),
      )
    : 0;

  const editorHref =
    section === "editor" && pathname.startsWith("/jobs/")
      ? pathname
      : "/library";

  return (
    <div className="console">
      <header className="tc-cmdbar">
        <Link href="/library" className="tc-mark" aria-label="Library home">
          TC
        </Link>
        <Link href="/library" className="tc-brand">
          telugu captions
        </Link>
        <span className="tc-vr" aria-hidden />
        <nav className="tc-tabs" aria-label="Sections">
          <Link href="/library" aria-current={section === "library" ? "page" : undefined}>
            Library
          </Link>
          <Link href={editorHref} aria-current={section === "editor" ? "page" : undefined}>
            Editor
          </Link>
          <Link href="/styles" aria-current={section === "styles" ? "page" : undefined}>
            Styles
          </Link>
          <Link href="/billing" aria-current={section === "settings" ? "page" : undefined}>
            Settings
          </Link>
        </nav>
        <span className="tc-sp" />
        <ConsoleThemeToggle />
        <Link href="/#upload" className="tc-btn tc-btn--primary tc-btn--sm">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Upload
        </Link>
        <Link
          href="/billing"
          className="tc-av"
          aria-label="Account settings"
          title={user?.email ?? "Account"}
        >
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" />
          ) : (
            initials(user)
          )}
        </Link>
      </header>

      <div className="tc-body">
        {showSidebar ? (
          <aside className="tc-pane-l">
            <div className="tc-grp">
              <h3>Library</h3>
              <Link href="/library" aria-current={section === "library" ? "page" : undefined}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 10h18" />
                </svg>
                All projects
                {counts ? <span className="c">{counts.all}</span> : null}
              </Link>
              <Link href="/library?filter=draft">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h4L20 8l-4-4L4 16z" />
                </svg>
                Drafts
                {counts ? <span className="c">{counts.draft}</span> : null}
              </Link>
              <Link href="/library?filter=done">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v12" />
                  <path d="M7 11l5 5 5-5" />
                  <path d="M4 20h16" />
                </svg>
                Ready
                {counts ? <span className="c">{counts.done}</span> : null}
              </Link>
              <Link href="/library?filter=work">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="8" />
                  <path d="M12 8v4l3 2" />
                </svg>
                Processing
                {counts ? <span className="c">{counts.work}</span> : null}
              </Link>
            </div>

            <div className="tc-grp">
              <h3>Tools</h3>
              <Link href="/styles" aria-current={section === "styles" ? "page" : undefined}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4" />
                </svg>
                My styles
              </Link>
              <Link href="/style-analyzer">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16M4 12h10M4 17h13" />
                </svg>
                Style analyzer
              </Link>
              <Link href="/style-request">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Custom style
              </Link>
              <Link href="/billing" aria-current={section === "settings" ? "page" : undefined}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
                </svg>
                Settings
              </Link>
            </div>

            {usage ? (
              <div className="tc-usage">
                <div className="tc-usage-top">
                  <b>{usage.planLabel}</b>
                  <span>{leftMin} min left</span>
                </div>
                <div className="tc-usage-bar">
                  <i style={{ width: `${pct}%` }} />
                </div>
                <small>
                  {usage.usedMinutes} / {usage.monthlyMinutes} min used
                </small>
                <Link
                  href="/billing"
                  className="tc-btn tc-btn--sm"
                  style={{ width: "100%", marginTop: 10 }}
                >
                  Upgrade
                </Link>
              </div>
            ) : null}
          </aside>
        ) : null}

        <div className="tc-pane-c">
          {title ? (
            <div className="tc-pane-head">
              <h2>{title}</h2>
              {titleExtra}
              <span className="tc-sp" />
              {headActions}
            </div>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
