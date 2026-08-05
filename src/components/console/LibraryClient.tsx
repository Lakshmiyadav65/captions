"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell, type ConsoleUser } from "@/components/console/AppShell";

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

function formatDuration(sec: number | null): string {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
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
  const [filter, setFilter] = useState(urlFilter);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");

  useEffect(() => {
    setFilter(
      urlFilter === "draft" || urlFilter === "done" || urlFilter === "work"
        ? urlFilter
        : "all",
    );
  }, [urlFilter]);

  const counts = useMemo(() => {
    let draft = 0;
    let done = 0;
    let work = 0;
    for (const j of jobs) {
      const k = statusKind(j.status);
      if (k === "done") done += 1;
      else if (k === "draft") draft += 1;
      else if (k === "work") work += 1;
    }
    return { all: jobs.length, draft, done, work };
  }, [jobs]);

  const visible = useMemo(() => {
    let list = jobs;
    if (filter === "draft") list = list.filter((j) => statusKind(j.status) === "draft");
    else if (filter === "done") list = list.filter((j) => statusKind(j.status) === "done");
    else if (filter === "work") list = list.filter((j) => statusKind(j.status) === "work");

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((j) => j.originalName.toLowerCase().includes(q));

    if (sort === "name") {
      list = [...list].sort((a, b) => a.originalName.localeCompare(b.originalName));
    }
    return list;
  }, [jobs, filter, query, sort]);

  const title =
    filter === "draft"
      ? "Drafts"
      : filter === "done"
        ? "Ready"
        : filter === "work"
          ? "Processing"
          : "All projects";

  return (
    <AppShell
      section="library"
      user={user}
      title={title}
      titleExtra={<span className="count">{visible.length} items</span>}
      counts={counts}
      headActions={
        <>
          <label className="tc-find">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              placeholder="Filter"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="tc-seg" role="group" aria-label="Sort">
            <button
              type="button"
              aria-pressed={sort === "recent"}
              onClick={() => setSort("recent")}
            >
              Recent
            </button>
            <button type="button" aria-pressed={sort === "name"} onClick={() => setSort("name")}>
              Name
            </button>
          </div>
        </>
      }
    >
      <div className="tc-pane-scroll">
        {visible.length === 0 ? (
          <div className="tc-empty">
            <b>Nothing here yet</b>
            <p>
              Upload a video from the landing page or hit Upload in the command bar to start
              captioning.
            </p>
            <Link href="/#upload" className="tc-btn tc-btn--primary tc-btn--sm">
              Upload video
            </Link>
            {filter !== "all" ? (
              <button
                type="button"
                className="tc-btn tc-btn--sm"
                onClick={() => router.push("/library")}
              >
                Show all projects
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="tc-list-head">
              <span />
              <span>Project</span>
              <span>Status</span>
              <span>Length</span>
              <span>Updated</span>
              <span />
            </div>
            <div role="listbox" aria-label="Projects">
              {visible.map((job) => {
                const kind = statusKind(job.status);
                return (
                  <Link key={job.id} href={`/jobs/${job.id}`} className="tc-item" role="option">
                    <span className="th" aria-hidden />
                    <span className="nm">
                      <b>{job.originalName}</b>
                      <span>{relativeTime(job.createdAt)}</span>
                    </span>
                    <span className={`tc-tag tc-tag--${kind === "fail" ? "fail" : kind}`}>
                      {statusLabel(job.status)}
                      {kind === "work" ? ` ${job.progress}%` : ""}
                    </span>
                    <span className="du">{formatDuration(job.durationSec)}</span>
                    <span className="st">{relativeTime(job.updatedAt)}</span>
                    <span className="tc-btn tc-btn--ghost tc-btn--sm">Open</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
