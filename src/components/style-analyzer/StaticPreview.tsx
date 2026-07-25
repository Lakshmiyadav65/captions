"use client";

import { useEffect, useRef, useState } from "react";
import type { SubtitleStyle } from "@/lib/subtitles/style";
import { DEFAULT_STYLE } from "@/lib/subtitles/style";
import { tokenizeSegment } from "@/lib/subtitles/karaoke";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import type { Segment } from "@/lib/transcription/types";

// A still, video-free preview of a caption rendered in a given SubtitleStyle. Reuses the
// exact SubtitleOverlay the player uses, so what you see here matches the burned MP4. The
// caption renders on a neutral gradient — never composited onto the analyzed screenshot.

export function StaticPreview({
  text,
  style,
  className,
}: {
  text: string;
  style: SubtitleStyle;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  // Merge defaults so older saved styles missing glow/boxMode/animation still render.
  const full: SubtitleStyle = { ...DEFAULT_STYLE, ...style };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  const segment: Segment = { start: 0, end: 100, text };
  // Show karaoke mid-fill so the highlight colour is visible in a still frame.
  const filled = full.karaoke
    ? Math.max(1, Math.ceil(tokenizeSegment(segment).length * 0.6))
    : 0;

  return (
    <div
      ref={ref}
      className={`relative w-full overflow-hidden rounded-xl ring-1 ring-white/10 ${className ?? ""}`}
      style={{
        aspectRatio: "16 / 9",
        background: "radial-gradient(120% 120% at 50% 0%, #334155 0%, #0f172a 70%)",
      }}
    >
      <SubtitleOverlay segment={segment} style={full} height={height} filled={filled} />
    </div>
  );
}
