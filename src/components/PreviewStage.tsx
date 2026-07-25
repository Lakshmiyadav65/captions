"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Segment } from "@/lib/transcription/types";
import type { SubtitleStyle } from "@/lib/subtitles/style";
import { tokenizeSegment, filledCount } from "@/lib/subtitles/karaoke";
import { SubtitleOverlay } from "./SubtitleOverlay";

// Video player with the live subtitle overlay on top. The stage is sized to the video's REAL
// aspect ratio (portrait/square/landscape) and fit within the available width and a max
// height, so the overlay maps 1:1 to the actual video pixels — captions can't spill past the
// frame the way they did when the stage was locked to 16:9 and the video was letterboxed.
// Tracks the real playhead with requestAnimationFrame for smooth karaoke highlighting.
//
// Native <video> fullscreen only shows the video (no caption overlay), and "exit then
// re-request on the stage" fails because requestFullscreen needs a user gesture. So we hide
// the native fullscreen control and expose our own button that fullscreens the stage.

function fitBox(availW: number, availH: number, aspect: number) {
  let w = availW;
  let h = availW / aspect;
  if (h > availH) {
    h = availH;
    w = availH * aspect;
  }
  return { w: Math.round(w), h: Math.round(h) };
}

export function PreviewStage({
  videoRef,
  videoUrl,
  segments,
  style,
  onTime,
  initialAspect,
  onPositionChange,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  segments: Segment[];
  style: SubtitleStyle;
  onTime?: (t: number) => void;
  /** Video aspect ratio known up front (detected server-side) to avoid a 16:9 flash. */
  initialAspect?: number;
  /** Drag caption on the preview to set vertical position (% from top). */
  onPositionChange?: (positionYPct: number) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(
    initialAspect && initialAspect > 0 ? initialAspect : 16 / 9,
  );
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [active, setActive] = useState<{ seg: Segment | null; filled: number }>({
    seg: null,
    filled: 0,
  });
  const lastReport = useRef(0);

  // Fit the video's aspect ratio inside the stage container (or the fullscreen viewport).
  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap) return;

    const compute = () => {
      const fs = document.fullscreenElement === stage;
      setIsFullscreen(fs);

      if (fs && stage) {
        setBox(fitBox(stage.clientWidth, stage.clientHeight, aspect));
        return;
      }

      const availW = wrap.clientWidth;
      if (!availW) return;
      const availH =
        wrap.clientHeight > 40
          ? wrap.clientHeight
          : Math.min(window.innerHeight * 0.62, 720);
      setBox(fitBox(availW, availH, aspect));
    };

    const ro = new ResizeObserver(compute);
    ro.observe(wrap);
    if (stage) ro.observe(stage);
    compute();
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [aspect]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(document.fullscreenElement === stageRef.current);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) {
        await document.exitFullscreen();
      } else {
        await stage.requestFullscreen();
      }
    } catch {
      // Browser blocked fullscreen (permissions / unsupported).
    }
  }, []);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (v?.videoWidth && v?.videoHeight) setAspect(v.videoWidth / v.videoHeight);
  };

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v) {
        const t = v.currentTime;
        const seg = segments.find((s) => t >= s.start && t < s.end) ?? null;
        const filled =
          seg &&
          (style.karaoke ||
            style.animation === "kinetic" ||
            style.animation === "scatter" ||
            style.animation === "hook" ||
            style.animation === "flash")
            ? filledCount(tokenizeSegment(seg), t)
            : 0;
        // Only re-render when the active line or the filled-word count actually changes.
        setActive((prev) =>
          prev.seg === seg && prev.filled === filled ? prev : { seg, filled },
        );
        if (onTime && Math.abs(t - lastReport.current) > 0.1) {
          lastReport.current = t;
          onTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [segments, videoRef, onTime, style.karaoke, style.animation]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div
        ref={wrapRef}
        className="flex min-h-0 w-full flex-1 items-center justify-center"
      >
        <div
          ref={stageRef}
          className={`preview-stage relative overflow-hidden bg-black shadow-lg ring-1 ring-white/10 ${
            isFullscreen
              ? "flex h-full w-full items-center justify-center rounded-none ring-0"
              : "rounded-xl"
          }`}
          style={
            isFullscreen
              ? undefined
              : box.w
                ? { width: box.w, height: box.h }
                : { width: "100%", aspectRatio: "16 / 9", maxHeight: "100%" }
          }
        >
          <div
            className="relative overflow-hidden bg-black"
            style={
              box.w
                ? { width: box.w, height: box.h }
                : { width: "100%", height: "100%" }
            }
          >
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={onLoadedMetadata}
              controls
              playsInline
              // Hide native FS — it can't include the caption overlay, and swapping FS
              // targets after the fact is blocked (no user gesture).
              controlsList="nofullscreen"
              disablePictureInPicture
              className="h-full w-full bg-black object-contain"
            />
            <SubtitleOverlay
              segment={active.seg}
              style={style}
              height={box.h}
              filled={active.filled}
              onPositionChange={onPositionChange}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void toggleFullscreen();
              }}
              className="absolute right-2 bottom-12 z-20 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-medium text-white shadow ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/90"
              title={isFullscreen ? "Exit full screen (Esc)" : "Full screen with captions"}
              aria-label={isFullscreen ? "Exit full screen" : "Full screen with captions"}
            >
              {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          </div>
        </div>
      </div>
      {onPositionChange && !isFullscreen && (
        <p className="mt-1.5 shrink-0 text-center text-[11px] text-neutral-500">
          Drag the caption up/down on the video — or use Top / Middle / Bottom in styles.
          Use the Full screen button on the preview so captions stay visible.
        </p>
      )}
    </div>
  );
}
