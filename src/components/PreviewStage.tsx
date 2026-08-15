"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Segment } from "@/lib/transcription/types";
import type { SubtitleStyle } from "@/lib/subtitles/style";
import { tokenizeSegment, filledCount } from "@/lib/subtitles/karaoke";
import { shamaniFilledAt } from "@/lib/subtitles/kinetic";
import {
  estimateCaptionRectPct,
  evaluateCaptionVisibility,
  type CaptionVisibility,
} from "@/lib/instagram/safe-zone";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { InstagramPreviewChrome } from "./instagram/InstagramPreviewChrome";
import { CaptionSafeZoneOverlay } from "./instagram/CaptionSafeZoneOverlay";

// Video player with the live subtitle overlay on top. The stage is sized to the video's REAL
// aspect ratio (portrait/square/landscape) and fit within the available width and a max
// height, so the overlay maps 1:1 to the actual video pixels — captions can't spill past the
// frame the way they did when the stage was locked to 16:9 and the video was letterboxed.
// Tracks the real playhead with requestAnimationFrame for smooth karaoke highlighting.
//
// Native <video> fullscreen only shows the video (no caption overlay), and "exit then
// re-request on the stage" fails because requestFullscreen needs a user gesture. So we hide
// the native control and fullscreen the stage from the editor toolbar instead.
//
// Optional Instagram Preview chrome reuses this same video + SubtitleOverlay — no second
// player — so Reels simulation always matches editor captions and position.

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
  onPlayingChange,
  onDuration,
  initialAspect,
  onPositionChange,
  instagramPreview = false,
  safeZoneEnabled = false,
  onCaptionVisibility,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  segments: Segment[];
  style: SubtitleStyle;
  onTime?: (t: number) => void;
  onPlayingChange?: (playing: boolean) => void;
  onDuration?: (duration: number) => void;
  /** Video aspect ratio known up front (detected server-side) to avoid a 16:9 flash. */
  initialAspect?: number;
  /** Drag caption on the preview to set vertical position (% from top). */
  onPositionChange?: (positionYPct: number) => void;
  /** Simulated Instagram Reels chrome over the real preview. */
  instagramPreview?: boolean;
  /** Show configurable caption safe-zone overlays (only meaningful with Instagram Preview). */
  safeZoneEnabled?: boolean;
  /** Reports estimated caption vs IG-UI collision level. */
  onCaptionVisibility?: (level: CaptionVisibility) => void;
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
  const [playhead, setPlayhead] = useState(0);
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
      // Prefer the wrap's laid-out height so portrait reels grow with the center column.
      const availH =
        wrap.clientHeight > 80
          ? wrap.clientHeight
          : Math.min(window.innerHeight * 0.7, 860);
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

  // Bind play/pause/duration on the mounted <video> so the transport stays in sync.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const syncDuration = () => {
      const d = v.duration;
      if (Number.isFinite(d) && d > 0) onDuration?.(d);
    };
    const onPlay = () => onPlayingChange?.(true);
    const onPause = () => onPlayingChange?.(false);
    const onEnded = () => onPlayingChange?.(false);

    v.addEventListener("loadedmetadata", syncDuration);
    v.addEventListener("durationchange", syncDuration);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    syncDuration();
    onPlayingChange?.(!v.paused);

    return () => {
      v.removeEventListener("loadedmetadata", syncDuration);
      v.removeEventListener("durationchange", syncDuration);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [videoRef, videoUrl, onPlayingChange, onDuration]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (v?.videoWidth && v?.videoHeight) setAspect(v.videoWidth / v.videoHeight);
    if (v && Number.isFinite(v.duration) && v.duration > 0) onDuration?.(v.duration);
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
            style.animation === "editorial" ||
            style.animation === "atelier" ||
            style.animation === "shamani" ||
            style.animation === "pinterest" ||
            style.animation === "pinterest4")
            ? style.animation === "shamani"
              ? shamaniFilledAt(tokenizeSegment(seg), t, seg.end)
              : filledCount(tokenizeSegment(seg), t)
            : 0;
        // Only re-render when the active line or the filled-word count actually changes.
        setActive((prev) =>
          prev.seg === seg && prev.filled === filled ? prev : { seg, filled },
        );
        setPlayhead(t);
        if (onTime && Math.abs(t - lastReport.current) > 0.04) {
          lastReport.current = t;
          onTime(t);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [segments, videoRef, onTime, style.karaoke, style.animation]);

  const visibility = useMemo(() => {
    if (!instagramPreview) return null as CaptionVisibility | null;
    const lines = active.seg
      ? Math.max(1, Math.ceil(active.seg.text.trim().split(/\s+/).length / 4))
      : 1.2;
    const rect = estimateCaptionRectPct(
      {
        positionYPct: style.positionYPct,
        fontSizePct: style.fontSizePct,
        lineHeight: style.lineHeight,
        maxWidthPct: style.maxWidthPct,
        align: style.align,
        bgPaddingYPct: style.bgPaddingYPct,
        boxMode: style.boxMode,
      },
      0.9 + lines * 0.45,
    );
    return evaluateCaptionVisibility(rect);
  }, [instagramPreview, style, active.seg]);

  useEffect(() => {
    if (visibility) onCaptionVisibility?.(visibility);
  }, [visibility, onCaptionVisibility]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div
        ref={wrapRef}
        className="flex min-h-0 w-full flex-1 items-center justify-center"
      >
        <div
          ref={stageRef}
          className={`preview-stage relative overflow-hidden bg-black shadow-[0_12px_30px_rgba(26,25,23,0.18)] ring-1 ring-black/10 ${
            isFullscreen
              ? "flex h-full w-full items-center justify-center rounded-none ring-0"
              : instagramPreview
                ? "rounded-[22px] ring-black/40"
                : "rounded-xl"
          } ${instagramPreview ? "ed-ig-stage" : ""}`}
          style={
            isFullscreen
              ? undefined
              : box.w
                ? { width: box.w, height: box.h }
                : {
                    width: "100%",
                    aspectRatio: String(aspect),
                    maxHeight: "100%",
                  }
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
              playsInline
              // Hide native FS — it can't include the caption overlay, and swapping FS
              // targets after the fact is blocked (no user gesture).
              controlsList="nofullscreen"
              disablePictureInPicture
              className="h-full w-full bg-black object-contain"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                if (v.paused) void v.play().catch(() => {});
                else v.pause();
              }}
            />
            <SubtitleOverlay
              segment={active.seg}
              style={style}
              height={box.h}
              width={box.w}
              filled={active.filled}
              onPositionChange={onPositionChange}
            />
            {instagramPreview && safeZoneEnabled && <CaptionSafeZoneOverlay />}
            {instagramPreview && (
              <InstagramPreviewChrome
                progressPct={
                  videoRef.current?.duration
                    ? (playhead / videoRef.current.duration) * 100
                    : 0
                }
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
