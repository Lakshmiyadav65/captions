"use client";

import {
  formatExportClock,
  secondaryForExportStatus,
  type ExportJobStatus,
} from "@/lib/export-job";

export function ExportProgress({
  status,
  progress,
  filename,
  renderedSec,
  totalSec,
}: {
  status: ExportJobStatus;
  progress: number;
  filename: string;
  renderedSec?: number;
  totalSec?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(progress)));
  const hasClock =
    typeof renderedSec === "number" &&
    typeof totalSec === "number" &&
    totalSec > 0;

  return (
    <div className="ed-export-progress">
      <div
        className="ed-export-bar"
        role="progressbar"
        aria-label="Export progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="ed-export-bar-fill" style={{ width: `${pct}%` }} />
      </div>

      <p className="ed-export-pct">
        {pct}%
        <small>complete</small>
      </p>

      {hasClock ? (
        <p className="ed-export-counter">
          {formatExportClock(renderedSec)} / {formatExportClock(totalSec)}
        </p>
      ) : null}

      <p className="ed-export-secondary">{secondaryForExportStatus(status)}</p>
      <p className="ed-export-filehint">{filename}</p>
    </div>
  );
}

export function ExportComplete({
  filename,
  downloading,
  onDownload,
  onClose,
}: {
  filename: string;
  downloading?: boolean;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div className="ed-export-progress">
      <div
        className="ed-export-bar"
        role="progressbar"
        aria-label="Export progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={100}
      >
        <span className="ed-export-bar-fill" style={{ width: "100%" }} />
      </div>
      <p className="ed-export-pct">
        100%
        <small>complete</small>
      </p>
      <p className="ed-export-secondary">Your video is ready to download.</p>
      <p className="ed-export-filename">{filename}</p>
      <div className="ed-export-actions">
        <button type="button" className="tc-btn tc-btn--ghost" onClick={onClose}>
          Close
        </button>
        <button
          type="button"
          className="tc-btn tc-btn--primary"
          onClick={onDownload}
          disabled={downloading}
        >
          {downloading ? "Downloading…" : "Download Video"}
        </button>
      </div>
    </div>
  );
}

export function ExportFailed({
  message,
  onRetry,
  onClose,
}: {
  message: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div className="ed-export-progress">
      <p className="ed-export-secondary">{message}</p>
      <div className="ed-export-actions">
        <button type="button" className="tc-btn tc-btn--ghost" onClick={onClose}>
          Close
        </button>
        <button type="button" className="tc-btn tc-btn--primary" onClick={onRetry}>
          Try Again
        </button>
      </div>
    </div>
  );
}
