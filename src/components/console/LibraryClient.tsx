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
  if (status === "extracting" || status === "transcribing") return "Rendering";
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
  const [startStyle, setStartStyle] = useState(PRESETS[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>(() => {
    if (urlFilter === "done") return "done";
    if (urlFilter === "draft") return "draft";
    return "all";
  });

  useEffect(() => {
    if (urlFilter === "done") setTab("done");
    else if (urlFilter === "draft") setTab("draft");
    else setTab("all");
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
  const showNew = view === "new";

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
      if (tab === "draft") list = list.filter((j) => statusKind(j.status) === "draft");
      else if (tab === "work") list = list.filter((j) => statusKind(j.status) === "work");
      else if (tab === "done") list = list.filter((j) => statusKind(j.status) === "done");
    }

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((j) => j.originalName.toLowerCase().includes(q));
    return list;
  }, [jobs, urlFilter, tab, showHome, query]);

  const styleChip = (id: string) => {
    const i = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0));
    return PRESETS[i % PRESETS.length]?.name ?? "Classic";
  };

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

  if (showNew) {
    return (
      <AppShell section="library" user={user} title="New project" hideTopBar>
        <div className="tc-home">
          <section className="tc-greet">
            <div>
              <h1>New project</h1>
              <p>Upload once. We transcribe, romanize, and build caption frames before the editor opens.</p>
            </div>
          </section>

          <Link href="/#upload" className="tc-drop tc-drop--lg">
            <span className="tc-drop-ic" aria-hidden>
              ↑
            </span>
            <span className="tc-drop-body">
              <b>Drop your video, or click to browse</b>
              <span className="fmt">MP4 · MOV · up to 3 minutes · vertical works best</span>
            </span>
          </Link>

          <div className="tc-new-grid">
            <div className="tc-card-plain tc-new-card">
              <div className="tc-card-head">
                <b>Caption defaults</b>
              </div>
              <div className="tc-row">
                <span>
                  <b>Script</b>
                  <span>Romanized by default — switch in the editor anytime.</span>
                </span>
                <div className="tc-seg">
                  <button type="button" aria-pressed="true">
                    Roman
                  </button>
                  <button type="button" aria-pressed="false">
                    Telugu
                  </button>
                </div>
              </div>
              <div className="tc-row">
                <span>
                  <b>Words per frame</b>
                  <span>How dense captions feel on screen.</span>
                </span>
                <div className="tc-seg">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button key={n} type="button" aria-pressed={n === 2} className="mono">
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="tc-card-plain tc-new-card">
              <div className="tc-card-head">
                <b>Starting style</b>
                <span>Applied when the editor opens. Change anytime.</span>
              </div>
              <div className="tc-start-styles">
                {PRESETS.slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`tc-start-style${startStyle === p.id ? " is-active" : ""}`}
                    onClick={() => {
                      setStartStyle(p.id);
                      try {
                        sessionStorage.setItem("pendingStyle", JSON.stringify(p.style));
                      } catch {
                        /* ignore */
                      }
                    }}
                  >
                    <span className="tc-start-style-sample" aria-hidden>
                      {p.sample ?? "Aa"}
                    </span>
                    <span className="tc-start-style-name">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      section="library"
      user={user}
      title="Projects"
      headSearch={!showHome ? search : undefined}
      hideTopBar={showHome}
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
            </section>

            <div className="tc-hero-row">
              <Link href="/#upload" className="tc-drop">
                <span className="tc-drop-ic" aria-hidden>
                  ↑
                </span>
                <span className="tc-drop-body">
                  <b>Drop a Short here</b>
                  <span className="fmt">MP4 or MOV · up to 3 minutes · Telugu audio</span>
                </span>
              </Link>
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
                <span className="tc-stat-label">Exports</span>
                <span className="tc-stat-value mono">{exported}</span>
                <span className="tc-stat-note">
                  {waiting > 0 ? `${waiting} in progress` : "this month"}
                </span>
              </div>
            </div>

            <div className="tc-filter-row">
              <div className="tc-seg" role="group" aria-label="Filter projects">
                {(
                  [
                    { id: "all" as const, label: "All" },
                    { id: "draft" as const, label: "Draft" },
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
              <span className="tc-sec-sub">Sorted by last edited</span>
            </div>
          </>
        ) : (
          <div className="tc-filter-row">
            <h2 style={{ margin: 0, fontSize: 16 }}>
              {urlFilter === "done" ? "Ready to export" : "Projects"}
            </h2>
            <button
              type="button"
              className="tc-btn tc-btn--ghost tc-btn--sm"
              onClick={() => router.push("/library")}
            >
              Back to Projects
            </button>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="tc-empty-card">
            <b>{tab === "done" || urlFilter === "done" ? "No exports yet" : "Nothing here yet"}</b>
            <p>
              {tab === "done" || urlFilter === "done"
                ? "Finish captioning a draft and hit Export — burned-in MP4s land here."
                : "Upload a video to start captioning."}
            </p>
          </div>
        ) : (
          <div className="tc-project-grid">
            {visible.map((job) => {
              const kind = statusKind(job.status);
              return (
                <Link key={job.id} href={`/jobs/${job.id}`} className="tc-project-card">
                  <div className="tc-project-thumb" aria-hidden>
                    <span className={`tc-project-status tc-badge tc-badge--${kind}`}>
                      {statusLabel(job.status)}
                      {kind === "work" ? ` ${job.progress}%` : ""}
                    </span>
                    <span className="tc-project-frame">9:16 frame</span>
                    <span className="tc-project-dur mono">{formatLength(job.durationSec)}</span>
                  </div>
                  <div className="tc-project-body">
                    <b className="tc-project-title">{job.originalName}</b>
                    <span className="tc-project-meta">
                      <span className="tc-project-style">{styleChip(job.id)}</span>
                      <span className="tc-project-time">{relativeTime(job.updatedAt)}</span>
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
