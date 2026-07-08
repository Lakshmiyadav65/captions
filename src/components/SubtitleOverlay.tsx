"use client";

import type { CSSProperties, ReactNode } from "react";
import { fontStack } from "@/lib/fonts";
import type { SubtitleStyle } from "@/lib/subtitles/style";
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
    background:
      style.backgroundOpacity > 0
        ? hexToRgba(style.backgroundColor, style.backgroundOpacity)
        : "transparent",
    padding: `${px(style.bgPaddingYPct)}px ${px(style.bgPaddingXPct)}px`,
    borderRadius: Math.max(2, 4 * scale),
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    WebkitTextStrokeWidth: stroke > 0 ? `${stroke}px` : undefined,
    WebkitTextStrokeColor: stroke > 0 ? style.outlineColor : undefined,
    paintOrder: "stroke fill",
    textShadow: style.shadow
      ? `0 ${1.5 * scale}px ${4 * scale}px rgba(0,0,0,0.85)`
      : "none",
  };

  // Karaoke: render each word as its own span so spoken words can take the highlight color.
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

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <div
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
    </div>
  );
}
