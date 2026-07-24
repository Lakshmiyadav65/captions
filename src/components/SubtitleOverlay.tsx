"use client";

import type { CSSProperties, ReactNode } from "react";
import { fontStack } from "@/lib/fonts";
import {
  effectiveBoxMode,
  hasBackgroundBox,
  type SubtitleStyle,
} from "@/lib/subtitles/style";
import { tokenizeSegment } from "@/lib/subtitles/karaoke";
import type { Segment } from "@/lib/transcription/types";

// Renders one active subtitle line over the video. All sizes are derived from the
// container HEIGHT so the preview scales with the player and matches the ASS export
// (which is authored against a 1080p canvas). When `style.karaoke` is on, the line is
// split into per-word spans and the first `filled` words take the highlight color —
// the same progressive fill the ASS \k tags produce in the burned MP4.

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function buildTextShadow(style: SubtitleStyle, scale: number): string {
  const parts: string[] = [];
  const glow = style.glowStrength ?? 0;
  if (glow > 0) {
    const c = style.glowColor || style.color;
    const g = glow * scale;
    parts.push(`0 0 ${g * 2}px ${hexToRgba(c, 0.95)}`);
    parts.push(`0 0 ${g * 4}px ${hexToRgba(c, 0.7)}`);
    parts.push(`0 0 ${g * 8}px ${hexToRgba(c, 0.4)}`);
  }
  if (style.shadow) {
    parts.push(`0 ${1.5 * scale}px ${4 * scale}px rgba(0,0,0,0.85)`);
  }
  return parts.length ? parts.join(", ") : "none";
}

function animationClass(style: SubtitleStyle): string {
  switch (style.animation) {
    case "fade":
      return "cap-anim-fade";
    case "pop":
      return "cap-anim-pop";
    default:
      return "";
  }
}

export function SubtitleOverlay({
  segment,
  style,
  height,
  filled = 0,
}: {
  segment: Segment | null;
  style: SubtitleStyle;
  height: number;
  /** Number of leading words already spoken (only used when style.karaoke). */
  filled?: number;
}) {
  if (!segment || !segment.text || height <= 0) return null;

  const px = (pct: number) => (pct / 100) * height;
  const scale = height / 1080;
  const stroke = style.outlineWidth * scale;
  const boxMode = effectiveBoxMode(style);
  const showBox = hasBackgroundBox(style);
  const isBar = boxMode === "bar" && showBox;
  const isPill = boxMode === "pill" && showBox;
  const isInline = boxMode === "inline" && showBox;

  const radius =
    isPill
      ? Math.max(4, px(style.boxRadiusPct ?? 1.2))
      : isInline
        ? Math.max(2, 4 * scale)
        : 0;

  const bg =
    showBox && !isBar
      ? hexToRgba(style.backgroundColor, style.backgroundOpacity)
      : "transparent";

  const spanStyle: CSSProperties = {
    display: "inline-block",
    maxWidth: "100%",
    fontFamily: fontStack(style.fontFamily),
    fontSize: px(style.fontSizePct),
    fontWeight: style.fontWeight,
    color: style.color,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacingEm}em`,
    textTransform: style.uppercase ? "uppercase" : "none",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: bg,
    padding: showBox && !isBar
      ? `${px(style.bgPaddingYPct)}px ${px(style.bgPaddingXPct)}px`
      : isBar
        ? `${px(Math.max(style.bgPaddingYPct, 1.2))}px ${px(style.bgPaddingXPct)}px`
        : "0",
    borderRadius: radius,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    WebkitTextStrokeWidth: stroke > 0 ? `${stroke}px` : undefined,
    WebkitTextStrokeColor: stroke > 0 ? style.outlineColor : undefined,
    paintOrder: "stroke fill",
    textShadow: buildTextShadow(style, scale),
  };

  let content: ReactNode = segment.text;
  if (style.karaoke) {
    const tokens = tokenizeSegment(segment);
    if (tokens.length) {
      content = tokens.map((tk, i) => (
        <span key={i} style={{ color: i < filled ? style.highlightColor : style.color }}>
          {tk.text}
          {i < tokens.length - 1 ? " " : ""}
        </span>
      ));
    }
  }

  const anim = animationClass(style);
  // Remount animation whenever the active line changes.
  const animKey = `${segment.start}-${style.animation}`;

  const barHeight = px(
    style.fontSizePct * style.lineHeight + Math.max(style.bgPaddingYPct, 1.2) * 2 + 1,
  );

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {isBar && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${style.positionYPct}%`,
            height: barHeight,
            transform: "translateY(-50%)",
            background: hexToRgba(style.backgroundColor, style.backgroundOpacity),
          }}
        />
      )}
      <div
        key={animKey}
        className={anim}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${style.positionYPct}%`,
          transform: "translateY(-50%)",
          padding: `0 ${(100 - style.maxWidthPct) / 2}%`,
          textAlign: style.align,
        }}
      >
        <span style={spanStyle}>{content}</span>
      </div>
      <style>{`
        @keyframes capFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes capPopIn {
          from { opacity: 0; transform: translateY(-50%) scale(0.85); }
          to { opacity: 1; transform: translateY(-50%) scale(1); }
        }
        .cap-anim-fade {
          animation: capFadeIn 0.28s ease-out both;
        }
        .cap-anim-pop {
          animation: capPopIn 0.32s cubic-bezier(0.22, 1.2, 0.36, 1) both;
        }
      `}</style>
    </div>
  );
}
