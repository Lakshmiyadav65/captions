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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

function firstName(user: ConsoleUser | null): string {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0]!;
  if (user?.email) return user.email.split("@")[0]!;
  return "there";
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
  const view = searchParams.get("view");
  const [filter, setFilter] = useState(urlFilter);
  const [planLabel, setPlanLabel] = useState("FREE PLAN");

  useEffect(() => {
    setFilter(
      urlFilter === "draft" || urlFilter === "done" || urlFilter === "work"
        ? urlFilter
        : "all",
    );
  }, [urlFilter]);

  useEffect(() => {
    void fetch("/api/billing/usage")
      .then(async (res) => (res.ok ? ((await res.json()) as { planLabel?: string }) : null))
      .then((data) => {
        if (data?.planLabel) setPlanLabel(data.planLabel.toUpperCase());
      })
      .catch(() => {});
  }, []);

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
    return list;
  }, [jobs, filter]);

  const showGreeting = filter === "all" && view !== "media";
  const sectionTitle =
    filter === "done"
      ? "Ready to export"
      : filter === "draft"
        ? "Drafts"
        : filter === "work"
          ? "Processing"
          : view === "media"
            ? "Media"
            : "Recent Projects";

  return (
    <AppShell section="library" user={user} counts={counts}>
      <div className="tc-home">
        {showGreeting ? (
          <section className="tc-greet">
            <div>
              <div className="tc-greet-badge">{planLabel}</div>
              <h1>
                {greeting()}, <em>{firstName(user)}</em>
              </h1>
              <p>Create AI-powered subtitles for your videos in seconds.</p>
            </div>
            <Link href="/#upload" className="tc-btn tc-btn--outline">
              + New Project
            </Link>
          </section>
        ) : null}

        <div className="tc-sec-head">
          <h2>{sectionTitle}</h2>
          {showGreeting ? (
            <Link href="/library?view=media">View all →</Link>
          ) : filter !== "all" || view === "media" ? (
            <button type="button" className="tc-btn tc-btn--ghost tc-btn--sm" onClick={() => router.push("/library")}>
              Back to Home
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="tc-empty" style={{ padding: "48px 24px" }}>
            <b>Nothing here yet</b>
            <p>Upload a video to start captioning.</p>
            <Link href="/#upload" className="tc-btn tc-btn--primary tc-btn--sm">
              Upload video
            </Link>
          </div>
        ) : (
          <div className="tc-card-grid">
            {visible.map((job) => {
              const kind = statusKind(job.status);
              return (
                <Link key={job.id} href={`/jobs/${job.id}`} className="tc-proj">
                  <div className="tc-proj-thumb" aria-hidden>
                    <span className="tc-badge tc-badge--subs">
                      {kind === "done" ? "Ready" : statusLabel(job.status)}
                      {kind === "work" ? ` ${job.progress}%` : ""}
                    </span>
                    {job.durationSec != null ? (
                      <span className="tc-badge tc-badge--ttl">
                        {Math.max(1, Math.round(job.durationSec / 60))}m
                      </span>
                    ) : null}
                  </div>
                  <div className="tc-proj-body">
                    <div>
                      <b>{job.originalName}</b>
                      <span>{relativeTime(job.updatedAt)}</span>
                    </div>
                    <span className="tc-proj-more" aria-hidden>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.6" />
                        <circle cx="12" cy="12" r="1.6" />
                        <circle cx="12" cy="19" r="1.6" />
                      </svg>
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
