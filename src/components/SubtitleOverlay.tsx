"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { fontStack } from "@/lib/fonts";
import {
  applyTextCase,
  effectiveBoxMode,
  effectiveTextCase,
  hasBackgroundBox,
  type SubtitleStyle,
} from "@/lib/subtitles/style";
import { tokenizeSegment } from "@/lib/subtitles/karaoke";
import type { Segment } from "@/lib/transcription/types";

// Renders one active subtitle line over the video. All sizes are derived from the
// container HEIGHT so the preview scales with the player and matches the ASS export.
// Users can drag the caption vertically (or use Top/Middle/Bottom in StylePanel) to
// place it anywhere on the frame.

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function buildTextShadow(style: SubtitleStyle, scale: number, prism: boolean): string {
  const parts: string[] = [];
  if (prism) {
    parts.push(`0 ${1 * scale}px 0 rgba(255,255,255,0.75)`);
    parts.push(`0 ${-1 * scale}px 0 rgba(0,0,0,0.12)`);
    parts.push(`0 ${3 * scale}px ${10 * scale}px rgba(15,23,42,0.35)`);
    parts.push(`0 0 ${14 * scale}px rgba(186,210,255,0.45)`);
    parts.push(`0 0 ${28 * scale}px rgba(255,180,220,0.25)`);
  }
  const glow = style.glowStrength ?? 0;
  if (glow > 0) {
    const c = style.glowColor || style.color;
    const g = glow * scale;
    parts.push(`0 0 ${g * 2}px ${hexToRgba(c, 0.95)}`);
    parts.push(`0 0 ${g * 4}px ${hexToRgba(c, 0.7)}`);
    parts.push(`0 0 ${g * 8}px ${hexToRgba(c, 0.4)}`);
  }
  if (style.shadow && !prism) {
    if ((style.outlineWidth ?? 0) <= 0) {
      parts.push(`0 ${2 * scale}px ${10 * scale}px rgba(0,0,0,0.78)`);
      parts.push(`0 ${1 * scale}px ${3 * scale}px rgba(0,0,0,0.55)`);
      parts.push(`0 0 ${6 * scale}px rgba(0,0,0,0.35)`);
    } else {
      parts.push(`0 ${1.5 * scale}px ${4 * scale}px rgba(0,0,0,0.85)`);
    }
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

function clampPos(pct: number): number {
  return Math.min(95, Math.max(5, Math.round(pct)));
}

export function SubtitleOverlay({
  segment,
  style,
  height,
  filled = 0,
  onPositionChange,
}: {
  segment: Segment | null;
  style: SubtitleStyle;
  height: number;
  /** Number of leading words already spoken (only used when style.karaoke). */
  filled?: number;
  /** Drag-to-reposition: vertical % from top of the video frame (5–95). */
  onPositionChange?: (positionYPct: number) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  if (height <= 0) return null;

  const px = (pct: number) => (pct / 100) * height;
  const scale = height / 1080;
  const stroke = style.outlineWidth * scale;
  const boxMode = effectiveBoxMode(style);
  const showBox = hasBackgroundBox(style);
  const isBar = boxMode === "bar" && showBox;
  const isPill = boxMode === "pill" && showBox;
  const isInline = boxMode === "inline" && showBox;
  const prism = (style.textEffect ?? "none") === "prism";
  const hasText = !!(segment && segment.text);
  // Ghost placeholder so users can still drag when the current moment has no line.
  const displayText = hasText ? segment!.text : "Drag to position";
  const isGhost = !hasText;

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

  const caseMode = effectiveTextCase(style);
  const casedText = applyTextCase(displayText, caseMode);

  const spanStyle: CSSProperties = {
    display: "inline-block",
    maxWidth: "100%",
    fontFamily: fontStack(style.fontFamily),
    fontSize: px(style.fontSizePct),
    fontWeight: style.fontWeight,
    color: prism ? undefined : style.color,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacingEm}em`,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: prism ? undefined : bg,
    padding: showBox && !isBar
      ? `${px(style.bgPaddingYPct)}px ${px(style.bgPaddingXPct)}px`
      : isBar
        ? `${px(Math.max(style.bgPaddingYPct, 1.2))}px ${px(style.bgPaddingXPct)}px`
        : "0",
    borderRadius: radius,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    WebkitTextStrokeWidth: !prism && stroke > 0 ? `${stroke}px` : undefined,
    WebkitTextStrokeColor: !prism && stroke > 0 ? style.outlineColor : undefined,
    paintOrder: "stroke fill",
    textShadow: buildTextShadow(style, scale, prism),
    opacity: isGhost ? 0.45 : 1,
    cursor: onPositionChange ? "ns-resize" : undefined,
    userSelect: "none",
    touchAction: "none",
  };

  let content: ReactNode = casedText;
  if (hasText && style.karaoke && !prism) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      content = tokens.map((tk, i) => {
        const word =
          caseMode === "sentence"
            ? i === 0
              ? applyTextCase(tk.text, "sentence")
              : tk.text.toLowerCase()
            : applyTextCase(tk.text, caseMode);
        return (
          <span key={i} style={{ color: i < filled ? style.highlightColor : style.color }}>
            {word}
            {i < tokens.length - 1 ? " " : ""}
          </span>
        );
      });
    }
  }

  const anim = hasText && !dragging.current ? animationClass(style) : "";
  const animKey = hasText
    ? `${segment!.start}-${style.animation}-${style.textEffect ?? "none"}`
    : "ghost";

  const barHeight = px(
    style.fontSizePct * style.lineHeight + Math.max(style.bgPaddingYPct, 1.2) * 2 + 1,
  );

  const setFromClientY = (clientY: number) => {
    if (!onPositionChange || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    if (rect.height <= 0) return;
    onPositionChange(clampPos(((clientY - rect.top) / rect.height) * 100));
  };

  return (
    <div
      ref={rootRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {isBar && !isGhost && (
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
          pointerEvents: onPositionChange ? "auto" : "none",
        }}
        onPointerDown={(e) => {
          if (!onPositionChange) return;
          e.preventDefault();
          e.stopPropagation();
          dragging.current = true;
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setFromClientY(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          setFromClientY(e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
        title={onPositionChange ? "Drag up/down to place captions" : undefined}
      >
        {prism && !isGhost ? (
          <span className="cap-prism" style={spanStyle}>
            {content}
          </span>
        ) : (
          <span style={spanStyle}>{content}</span>
        )}
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
        @keyframes capPrismShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .cap-anim-fade {
          animation: capFadeIn 0.28s ease-out both;
        }
        .cap-anim-pop {
          animation: capPopIn 0.32s cubic-bezier(0.22, 1.2, 0.36, 1) both;
        }
        .cap-prism {
          background-image: linear-gradient(
            115deg,
            rgba(255,255,255,0.95) 0%,
            rgba(210,230,255,0.75) 18%,
            rgba(255,255,255,0.88) 32%,
            rgba(255,200,240,0.7) 48%,
            rgba(200,255,240,0.75) 62%,
            rgba(255,255,255,0.92) 78%,
            rgba(220,210,255,0.8) 100%
          );
          background-size: 220% 220%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: capPrismShimmer 4.5s ease-in-out infinite;
          filter: drop-shadow(0 1px 0 rgba(255,255,255,0.35))
            drop-shadow(0 2px 6px rgba(15,23,42,0.35));
        }
      `}</style>
    </div>
  );
}
