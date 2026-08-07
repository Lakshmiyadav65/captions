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
  if (status === "done") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "queued") return "Draft";
  if (status === "extracting") return "Extracting";
  if (status === "transcribing") return "Transcribing";
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

type Tab = "all" | "draft" | "done";

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
  const [tab, setTab] = useState<Tab>(() => {
    if (urlFilter === "done") return "done";
    if (urlFilter === "draft" || urlFilter === "work") return "draft";
    return "all";
  });

  // Keep local segment in sync when arriving via sidebar Export/Media links.
  useEffect(() => {
    if (urlFilter === "done") setTab("done");
    else if (urlFilter === "draft" || urlFilter === "work") setTab("draft");
  }, [urlFilter]);

  const showHome = !view && urlFilter === "all";

  const waiting = useMemo(
    () => jobs.filter((j) => statusKind(j.status) === "draft" || statusKind(j.status) === "work").length,
    [jobs],
  );
  const exporting = useMemo(
    () => jobs.filter((j) => statusKind(j.status) === "work").length,
    [jobs],
  );

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
        list = list.filter((j) => {
          const k = statusKind(j.status);
          return k === "draft" || k === "work";
        });
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
    ? "Home"
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
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
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
                  {waiting === 0
                    ? "Nothing waiting on captions right now."
                    : waiting === 1
                      ? "One clip is waiting on captions."
                      : `${waiting} clips are waiting on captions.`}
                  {exporting === 0
                    ? " Nothing is exporting right now."
                    : exporting === 1
                      ? " One project is still processing."
                      : ` ${exporting} projects are still processing.`}
                </p>
              </div>
            </section>

            <Link href="/#upload" className="tc-drop">
              <span className="tc-drop-ic" aria-hidden>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4" />
                  <path d="M7 9l5-5 5 5" />
                  <path d="M4 20h16" />
                </svg>
              </span>
              <span className="tc-drop-body">
                <b>Drop a video to caption it</b>
                <span>Telugu speech becomes word-timed captions in about 40 seconds.</span>
                <span className="fmt">MP4 · MOV · WEBM — up to 2 GB</span>
              </span>
              <span className="tc-btn tc-btn--primary" style={{ height: 44, padding: "0 20px" }} aria-hidden>
                Choose a video
              </span>
            </Link>

            <section style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
              <div className="tc-sec-head">
                <div>
                  <h2>Caption styles</h2>
                  <p>Live looks from Styles 2.0 — pick one in the editor when you open a project.</p>
                </div>
                <Link href="/#styles" className="tc-btn tc-btn--sm">
                  Browse all {PRESETS.length}
                </Link>
              </div>
              <div className="tc-strip">
                {styleStrip.map((p) => (
                  <Link key={p.id} href="/#upload" className="tc-tile" title={p.name}>
                    <div className="tc-tile-cap">
                      <span>{p.sample ?? "meeru ee"}</span>
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

        <section style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
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
            </div>
            {showHome ? (
              <div className="tc-seg" role="group" aria-label="Filter projects">
                {(
                  [
                    { id: "all" as const, label: "All" },
                    { id: "draft" as const, label: "Drafts" },
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
                Back to Home
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="tc-panel">
              <div className="tc-empty">
                <b>{tab === "done" || urlFilter === "done" ? "No exports yet" : "Nothing here yet"}</b>
                <p>
                  {tab === "done" || urlFilter === "done"
                    ? "Finish captioning a draft and hit Export — burned-in 1080p MP4s land here."
                    : "Upload a video to start captioning."}
                </p>
                <Link href="/#upload" className="tc-btn tc-btn--primary tc-btn--sm">
                  Upload video
                </Link>
              </div>
            </div>
          ) : (
            <div className="tc-panel">
              <table className="tc-tbl">
                <thead>
                  <tr>
                    <th style={{ width: "46%" }}>Project</th>
                    <th>Status</th>
                    <th>Length</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((job) => {
                    const kind = statusKind(job.status);
                    return (
                      <tr key={job.id}>
                        <td>
                          <div className="tc-cell-name">
                            <span className="tc-thumb" aria-hidden />
                            <Link href={`/jobs/${job.id}`}>
                              <b>{job.originalName}</b>
                              <span>{relativeTime(job.updatedAt)}</span>
                            </Link>
                          </div>
                        </td>
                        <td>
                          <span className={`tc-badge tc-badge--${kind}`}>
                            {statusLabel(job.status)}
                            {kind === "work" ? ` ${job.progress}%` : ""}
                          </span>
                        </td>
                        <td className="mono" style={{ fontFamily: "var(--mono)", color: "var(--ink-2)" }}>
                          {formatLength(job.durationSec)}
                        </td>
                        <td style={{ color: "var(--ink-3)" }}>{relativeTime(job.updatedAt)}</td>
                        <td>
                          <div className="tc-row-actions">
                            <Link href={`/jobs/${job.id}`} className="tc-btn tc-btn--sm">
                              Open
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
