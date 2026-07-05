"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Segment } from "@/lib/transcription/types";
import type { SubtitleStyle } from "@/lib/subtitles/style";
import { SubtitleOverlay } from "./SubtitleOverlay";

// Video player with the live subtitle overlay on top. Tracks the real playhead with
// requestAnimationFrame (smoother than the coarse `timeupdate` event) and measures its
// own height so the overlay can size subtitles proportionally.

export function PreviewStage({
  videoRef,
  videoUrl,
  segments,
  style,
  onTime,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  segments: Segment[];
  style: SubtitleStyle;
  onTime?: (t: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const [text, setText] = useState("");
  const lastReport = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setHeight(el.clientHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        const active = segments.find((s) => t >= s.start && t < s.end);
        // setState bails out when the string is unchanged, so this only re-renders
        // the overlay at segment boundaries.
        setText(active ? active.text : "");
        if (onTime && Math.abs(t - lastReport.current) > 0.1) {
          lastReport.current = t;
          onTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [segments, videoRef, onTime]);

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl bg-black shadow-lg ring-1 ring-white/10"
      style={{ aspectRatio: "16 / 9" }}
    >
      <video
        ref={videoRef}
        src={videoUrl}
        controls
        playsInline
        className="h-full w-full bg-black object-contain"
      />
      <SubtitleOverlay text={text} style={style} height={height} />
    </div>
  );
}
