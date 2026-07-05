"use client";

import type { CSSProperties } from "react";
import { fontStack } from "@/lib/fonts";
import type { SubtitleStyle } from "@/lib/subtitles/style";

// Renders one active subtitle line over the video. All sizes are derived from the
// container HEIGHT so the preview scales with the player and matches the ASS export
// (which is authored against a 1080p canvas).

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export function SubtitleOverlay({
  text,
  style,
  height,
}: {
  text: string;
  style: SubtitleStyle;
  height: number;
}) {
  if (!text || height <= 0) return null;

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
        <span style={spanStyle}>{text}</span>
      </div>
    </div>
  );
}
