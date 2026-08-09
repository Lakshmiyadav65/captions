"use client";

import {
  VISIBILITY_COPY,
  type CaptionVisibility,
} from "@/lib/instagram/safe-zone";

export function CaptionVisibilityIndicator({
  level,
}: {
  level: CaptionVisibility;
}) {
  const copy = VISIBILITY_COPY[level];
  return (
    <div
      className={`ed-ig-visibility ed-ig-visibility--${level}`}
      role="status"
      aria-live="polite"
    >
      <span className="ed-ig-visibility-dot" aria-hidden />
      <div>
        <b>{copy.label}</b>
        <small>{copy.hint}</small>
      </div>
    </div>
  );
}
