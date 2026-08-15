"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Segment } from "@/lib/transcription/types";
import type { SubtitleStyle } from "@/lib/subtitles";
import { downloadFromUrl } from "@/lib/browser-download";
import {
  defaultExportBasename,
  validateExportBasename,
} from "@/lib/export-filename";
import {
  titleForExportStatus,
  type ExportJobStatus,
  type ExportProgressEvent,
} from "@/lib/export-job";
import { readSseStream } from "@/lib/export-sse";
import { FilenameDialog } from "@/components/export/FilenameDialog";
import {
  ExportComplete,
  ExportFailed,
  ExportProgress,
} from "@/components/export/ExportProgress";

type Phase = "filename" | "progress" | "complete" | "failed";

export function ExportModal({
  open,
  onClose,
  jobId,
  originalName,
  style,
  segments,
  onBusyChange,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  originalName: string | null;
  style: SubtitleStyle;
  segments: Segment[] | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const terminalRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("filename");
  const [basename, setBasename] = useState(defaultExportBasename(originalName));
  const [filenameError, setFilenameError] = useState<string | null>(null);
  const [status, setStatus] = useState<ExportJobStatus>("queued");
  const [progress, setProgress] = useState(0);
  const [renderedSec, setRenderedSec] = useState<number | undefined>();
  const [totalSec, setTotalSec] = useState<number | undefined>();
  const [filename, setFilename] = useState(`${defaultExportBasename(originalName)}.mp4`);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("We couldn't export your video. Please try again.");
  const [downloading, setDownloading] = useState(false);

  const resetToFilename = useCallback(() => {
    setPhase("filename");
    setBasename(defaultExportBasename(originalName));
    setFilenameError(null);
    setProgress(0);
    setStatus("queued");
    setUrl(null);
  }, [originalName]);

  useEffect(() => {
    if (!open) return;
    if (!busyRef.current) resetToFilename();
  }, [open, resetToFilename]);

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busyRef.current) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const focusable = [
        ...node.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  const applyEvent = (event: ExportProgressEvent) => {
    if (event.filename) setFilename(event.filename);
    if (typeof event.progress === "number") setProgress(event.progress);
    if (typeof event.renderedSec === "number") setRenderedSec(event.renderedSec);
    if (typeof event.totalSec === "number") setTotalSec(event.totalSec);
    if (event.status === "completed" && event.url) {
      terminalRef.current = true;
      setUrl(event.url);
      setProgress(100);
      setStatus("completed");
      setPhase("complete");
      return;
    }
    if (event.status === "failed") {
      terminalRef.current = true;
      setError(event.error || "We couldn't export your video. Please try again.");
      setStatus("failed");
      setPhase("failed");
      return;
    }
    setStatus(event.status);
    setPhase("progress");
  };

  const pollExportStatus = async () => {
    for (let i = 0; i < 450 && !terminalRef.current; i++) {
      const statusRes = await fetch(`/api/export/${jobId}`);
      const data = (await statusRes.json().catch(() => ({}))) as {
        status?: string;
        progress?: number;
        filename?: string;
        url?: string;
        error?: string;
      };
      if (data.status === "completed" && data.url) {
        applyEvent({ ...data, status: "completed", progress: 100 });
        return;
      }
      if (data.status === "failed") {
        applyEvent({
          status: "failed",
          progress: 0,
          error: data.error || "We couldn't export your video. Please try again.",
        });
        return;
      }
      if (data.status && data.status !== "idle") {
        applyEvent({
          status: data.status as ExportProgressEvent["status"],
          progress: data.progress ?? 0,
          filename: data.filename,
        });
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  };

  const startExport = async (name = basename) => {
    if (busyRef.current || !segments?.length) return;
    const validated = validateExportBasename(name);
    if (!validated.ok) {
      setFilenameError(validated.error);
      setPhase("filename");
      return;
    }

    busyRef.current = true;
    terminalRef.current = false;
    onBusyChange?.(true);
    setFilenameError(null);
    setFilename(validated.filename);
    setBasename(validated.basename);
    setPhase("progress");
    setStatus("queued");
    setProgress(0);
    setRenderedSec(undefined);
    setTotalSec(undefined);
    setUrl(null);

    try {
      const res = await fetch(`/api/export/${jobId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          style,
          segments,
          filename: validated.basename,
          stream: true,
        }),
      });

      if (res.status === 400) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setFilenameError(data.error ?? "Please enter a valid file name.");
        setPhase("filename");
        return;
      }

      if (res.status === 409) {
        await pollExportStatus();
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("text/event-stream") && res.body) {
        await readSseStream<ExportProgressEvent>(res.body, applyEvent);
        if (!terminalRef.current) await pollExportStatus();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          url?: string;
          filename?: string;
          error?: string;
        };
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? `Export failed (${res.status})`);
        }
        applyEvent({
          status: "completed",
          progress: 100,
          url: data.url,
          filename: data.filename ?? validated.filename,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't export your video. Please try again.");
      setPhase("failed");
      setStatus("failed");
    } finally {
      busyRef.current = false;
      onBusyChange?.(false);
    }
  };

  const handleDownload = async () => {
    if (!url || downloading) return;
    setDownloading(true);
    try {
      await downloadFromUrl(url, filename);
    } finally {
      setDownloading(false);
    }
  };

  const handleClose = () => {
    if (busyRef.current) return;
    onClose();
  };

  if (!open) return null;

  const title =
    phase === "filename"
      ? "Choose a file name"
      : titleForExportStatus(status);

  return (
    <div className="ed-export-overlay" onMouseDown={handleClose}>
      <div
        ref={dialogRef}
        className="ed-export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id={titleId} className="ed-export-title" aria-live="polite">
          {title}
        </h2>

        {phase === "filename" ? (
          <FilenameDialog
            value={basename}
            error={filenameError}
            disabled={busyRef.current}
            onChange={(value) => {
              setBasename(value);
              if (filenameError) setFilenameError(null);
            }}
            onCancel={handleClose}
            onSubmit={() => void startExport()}
          />
        ) : null}

        {phase === "progress" ? (
          <ExportProgress
            status={status}
            progress={progress}
            filename={filename}
            renderedSec={renderedSec}
            totalSec={totalSec}
          />
        ) : null}

        {phase === "complete" ? (
          <ExportComplete
            filename={filename}
            downloading={downloading}
            onDownload={() => void handleDownload()}
            onClose={handleClose}
          />
        ) : null}

        {phase === "failed" ? (
          <ExportFailed
            message={error}
            onRetry={() => void startExport(basename)}
            onClose={handleClose}
          />
        ) : null}
      </div>
    </div>
  );
}
