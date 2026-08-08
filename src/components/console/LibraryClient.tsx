"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell, type ConsoleUser } from "@/components/console/AppShell";
import { PRESETS } from "@/components/presets";

export type LibraryJob = {
  id: string;
  status: string;
  progress: number;
  originalName: string;
  durationSec: number | null;
  createdAt: string;
  updatedAt: string;
};

function statusKind(status: string): "draft" | "done" | "work" | "fail" {
  if (status === "done") return "done";
  if (status === "failed") return "fail";
  if (status === "queued") return "draft";
  return "work";
}

function statusLabel(status: string): string {
  if (status === "done") return "Exported";
  if (status === "failed") return "Failed";
  if (status === "queued") return "Draft";
  if (status === "extracting") return "Rendering";
  if (status === "transcribing") return "Rendering";
  return status;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function firstName(user: ConsoleUser | null): string {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0]!;
  if (user?.email) return user.email.split("@")[0]!;
  return "there";
}

function formatLength(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

type Tab = "all" | "draft" | "work" | "done";

type Usage = {
  planLabel: string;
  usedMinutes: number;
  monthlyMinutes: number;
};

export function LibraryClient({
  jobs,
  user,
  initialFilter = "all",
}: {
  jobs: LibraryJob[];
  user: ConsoleUser | null;
  initialFilter?: string;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlFilter = searchParams.get("filter") ?? initialFilter;
  const view = searchParams.get("view");
  const [query, setQuery] = useState("");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    if (urlFilter === "done") return "done";
    if (urlFilter === "draft") return "draft";
    if (urlFilter === "work") return "work";
    return "all";
  });

  useEffect(() => {
    if (urlFilter === "done") setTab("done");
    else if (urlFilter === "draft") setTab("draft");
    else if (urlFilter === "work") setTab("work");
  }, [urlFilter]);

  useEffect(() => {
    void fetch("/api/billing/usage")
      .then(async (res) => (res.ok ? ((await res.json()) as Usage) : null))
      .then((data) => {
        if (data) setUsage(data);
      })
      .catch(() => {});
  }, []);

  const showHome = !view && urlFilter === "all";

  const waiting = useMemo(
    () => jobs.filter((j) => statusKind(j.status) === "draft" || statusKind(j.status) === "work").length,
    [jobs],
  );
  const exporting = useMemo(
    () => jobs.filter((j) => statusKind(j.status) === "work").length,
    [jobs],
  );
  const exported = useMemo(
    () => jobs.filter((j) => statusKind(j.status) === "done").length,
    [jobs],
  );

  const minutesLeft = usage
    ? Math.max(0, Math.round((usage.monthlyMinutes - usage.usedMinutes) * 10) / 10)
    : null;

  const visible = useMemo(() => {
    let list = jobs;

    if (urlFilter === "done") {
      list = list.filter((j) => statusKind(j.status) === "done");
    } else if (urlFilter === "draft") {
      list = list.filter((j) => statusKind(j.status) === "draft");
    } else if (urlFilter === "work") {
      list = list.filter((j) => statusKind(j.status) === "work");
    } else if (showHome) {
      if (tab === "draft") {
        list = list.filter((j) => statusKind(j.status) === "draft");
      } else if (tab === "work") {
        list = list.filter((j) => statusKind(j.status) === "work");
      } else if (tab === "done") {
        list = list.filter((j) => statusKind(j.status) === "done");
      }
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((j) => j.originalName.toLowerCase().includes(q));
    }
    return list;
  }, [jobs, urlFilter, tab, showHome, query]);

  const styleStrip = PRESETS.slice(0, 6);

  const topTitle = showHome
    ? "Projects"
    : urlFilter === "done"
      ? "Export"
      : view === "media"
        ? "Media"
        : urlFilter === "draft"
          ? "Drafts"
          : urlFilter === "work"
            ? "Processing"
            : "Projects";

  const search = (
    <label className="tc-search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </svg>
      <input
        type="search"
        placeholder="Search projects"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search projects"
      />
    </label>
  );

  const actions = (
    <Link href="/#upload" className="tc-btn tc-btn--primary">
      <span aria-hidden>+</span>
      New project
    </Link>
  );

  return (
    <AppShell
      section="library"
      user={user}
      title={topTitle}
      headSearch={search}
      headActions={actions}
    >
      <div className="tc-home">
        {showHome ? (
          <>
            <section className="tc-greet">
              <div>
                <h1>
                  Good <em>{greetingWord()}</em>, {firstName(user)}
                </h1>
                <p>
                  {jobs.length} project{jobs.length === 1 ? "" : "s"}
                  {exporting > 0 ? ` · ${exporting} waiting on export` : ""}
                  {minutesLeft != null ? ` · ${minutesLeft} minutes left this month` : ""}
                </p>
              </div>
              <Link href="/#upload" className="tc-btn tc-btn--primary">
                <span aria-hidden>+</span>
                New project
              </Link>
            </section>

            <Link href="/#upload" className="tc-drop">
              <span className="tc-drop-ic" aria-hidden>
                ↑
              </span>
              <span className="tc-drop-body">
                <b>Drop a video to caption it</b>
                <span className="fmt">MP4 or MOV · up to 3 minutes · Telugu audio</span>
              </span>
            </Link>

            <section className="tc-stats">
              <div className="tc-stat">
                <span className="tc-stat-label">Minutes left</span>
                <span className="tc-stat-value mono">
                  {minutesLeft != null ? String(minutesLeft) : "—"}
                </span>
                <span className="tc-stat-note">
                  {usage ? `of ${usage.monthlyMinutes}` : "this month"}
                </span>
              </div>
              <div className="tc-stat">
                <span className="tc-stat-label">Projects</span>
                <span className="tc-stat-value mono">{jobs.length}</span>
                <span className="tc-stat-note">
                  {waiting > 0 ? `${waiting} in progress` : "all clear"}
                </span>
              </div>
              <div className="tc-stat">
                <span className="tc-stat-label">Exports</span>
                <span className="tc-stat-value mono">{exported}</span>
                <span className="tc-stat-note">ready to download</span>
              </div>
            </section>

            <section className="tc-sec">
              <div className="tc-sec-head">
                <div>
                  <h2>Caption styles</h2>
                  <p>Live looks — pick one in the editor when you open a project.</p>
                </div>
                <Link href="/#styles" className="tc-btn tc-btn--sm">
                  Browse all {PRESETS.length}
                </Link>
              </div>
              <div className="tc-strip">
                {styleStrip.map((p) => (
                  <Link key={p.id} href="/#upload" className="tc-tile" title={p.name}>
                    <div className="tc-tile-cap">
                      <span>{p.sample ?? "Aa"}</span>
                    </div>
                    <div className="tc-tile-foot">
                      <b>{p.name}</b>
                      <span className="k">{p.tag ?? p.category}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <section className="tc-sec">
          <div className="tc-sec-head">
            <div>
              <h2>
                {showHome
                  ? "Your projects"
                  : urlFilter === "done"
                    ? "Ready to export"
                    : view === "media"
                      ? "All media"
                      : "Projects"}
              </h2>
              {showHome ? (
                <p className="tc-sec-sub">Sorted by last edited</p>
              ) : null}
            </div>
            {showHome ? (
              <div className="tc-seg" role="group" aria-label="Filter projects">
                {(
                  [
                    { id: "all" as const, label: "All" },
                    { id: "draft" as const, label: "Draft" },
                    { id: "work" as const, label: "Rendering" },
                    { id: "done" as const, label: "Exported" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    aria-pressed={tab === opt.id}
                    onClick={() => setTab(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                className="tc-btn tc-btn--ghost tc-btn--sm"
                onClick={() => router.push("/library")}
              >
                Back to Projects
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="tc-empty-card">
              <b>{tab === "done" || urlFilter === "done" ? "No exports yet" : "Nothing here yet"}</b>
              <p>
                {tab === "done" || urlFilter === "done"
                  ? "Finish captioning a draft and hit Export — burned-in MP4s land here."
                  : "Upload a video to start captioning."}
              </p>
              <Link href="/#upload" className="tc-btn tc-btn--primary tc-btn--sm">
                Upload video
              </Link>
            </div>
          ) : (
            <div className="tc-project-grid">
              {visible.map((job) => {
                const kind = statusKind(job.status);
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="tc-project-card">
                    <div className="tc-project-thumb" aria-hidden>
                      <span className="tc-project-frame">9:16 frame</span>
                      <span className="tc-project-dur mono">{formatLength(job.durationSec)}</span>
                    </div>
                    <div className="tc-project-body">
                      <b className="tc-project-title">{job.originalName}</b>
                      <span className="tc-project-meta">
                        <span className={`tc-badge tc-badge--${kind}`}>
                          {statusLabel(job.status)}
                          {kind === "work" ? ` ${job.progress}%` : ""}
                        </span>
                        <span className="tc-project-time">{relativeTime(job.updatedAt)}</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
