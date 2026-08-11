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
import { isEmphasisOn, isEmphasizedWord } from "@/lib/subtitles/emphasis";
import { tokenizeSegment } from "@/lib/subtitles/karaoke";
import {
  ATELIER_FOCUS_SCALE,
  ATELIER_ROLL_SCALE,
  ATELIER_SATELLITE_FONT,
  ATELIER_SATELLITE_SCALE,
  atelierLayout,
  atelierVariant,
  EDITORIAL_FOCUS_SCALE,
  EDITORIAL_SATELLITE_FONT,
  EDITORIAL_SATELLITE_SCALE,
  editorialLayout,
  FLASH_SCALE,
  HOOK_FOCUS_SCALE,
  HOOK_SATELLITE_FONT,
  HOOK_SATELLITE_SCALE,
  hookLayout,
  isAtelier,
  isEditorial,
  isFlash,
  isHook,
  isKinetic,
  isRomance,
  isScatter,
  kineticFocusIndex,
  kineticGapPct,
  kineticPoses,
  ROMANCE_FOCUS_SCALE,
  ROMANCE_SCRIPT_FONT,
  ROMANCE_SCRIPT_SCALE,
  ROMANCE_TRAIL_SCALE,
  ROMANCE_TRAIL_TRACKING_EM,
  romanceLayout,
  scatterPoses,
  scatterStageHeightPct,
} from "@/lib/subtitles/kinetic";
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
    case "kinetic":
      return "cap-anim-kinetic";
    case "scatter":
      return "cap-anim-kinetic";
    case "hook":
      return "cap-anim-kinetic";
    case "flash":
      return "cap-anim-pop";
    case "editorial":
      return "cap-anim-fade";
    case "atelier":
      return "cap-anim-kinetic";
    case "romance":
      return "cap-anim-kinetic";
    case "typewriter":
      return "cap-anim-typewriter";
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
  const effect = style.textEffect ?? "none";
  const prism = effect === "prism";
  const ember = effect === "ember";
  const negative = effect === "negative";
  const specialFill = prism || ember || negative;
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

  // Boxed captions: slightly more top padding so glyphs sit optically centered
  // in the white pill (Telugu/Latin fonts often sit high in the em box).
  const boxPadY = px(style.bgPaddingYPct);
  const boxPadX = px(style.bgPaddingXPct);
  const opticalNudge = showBox && !isBar ? Math.max(1, px(style.fontSizePct) * 0.08) : 0;

  let content: ReactNode = casedText;
  const useKinetic = hasText && isKinetic(style) && !specialFill;
  const useScatter = hasText && isScatter(style) && !specialFill;
  const useHook = hasText && isHook(style) && !specialFill;
  const useFlash = hasText && isFlash(style) && !specialFill;
  const useEditorial = hasText && isEditorial(style) && !specialFill;
  const useAtelier = hasText && isAtelier(style) && !specialFill;
  const useRomance = hasText && isRomance(style) && !specialFill;
  const useKaraoke =
    hasText &&
    style.karaoke &&
    !specialFill &&
    !useKinetic &&
    !useScatter &&
    !useHook &&
    !useFlash &&
    !useEditorial &&
    !useAtelier &&
    !useRomance;
  const useEmphasis =
    hasText &&
    isEmphasisOn(style) &&
    !specialFill &&
    !useKinetic &&
    !useScatter &&
    !useHook &&
    !useFlash &&
    !useEditorial &&
    !useAtelier &&
    !useRomance;
  // Karaoke/emphasis emit one <span> per word. Use a wrapping flex row with
  // flex: 0 0 auto on each word so they never shrink mid-glyph, and justify
  // center so multi-word phrases stay in the middle of the frame.
  const useWordSpans = useKaraoke || useEmphasis;
  const boxedInline = showBox && !isBar;

  const spanStyle: CSSProperties = {
    // Karaoke/emphasis: inline-flex + wrap + non-shrinking words keeps phrases centered
    // and intact. Plain boxed text still uses inline-flex for optical vertical centering.
    display: boxedInline || useWordSpans ? "inline-flex" : "inline-block",
    flexWrap: useWordSpans ? "wrap" : undefined,
    columnGap: useWordSpans ? "0.3em" : undefined,
    rowGap: useWordSpans ? "0.05em" : undefined,
    alignItems: boxedInline || useWordSpans ? "center" : undefined,
    justifyContent:
      boxedInline || useWordSpans
        ? style.align === "left"
          ? "flex-start"
          : style.align === "right"
            ? "flex-end"
            : "center"
        : undefined,
    maxWidth: "100%",
    // Shrink-wrap to the phrase so parent text-align / justify can center the box.
    width: useWordSpans ? "fit-content" : undefined,
    fontFamily: fontStack(style.fontFamily),
    fontSize: px(style.fontSizePct),
    fontWeight: style.fontWeight,
    color: specialFill ? undefined : style.color,
    lineHeight: boxedInline || useWordSpans ? 1.15 : style.lineHeight,
    letterSpacing: `${style.letterSpacingEm}em`,
    whiteSpace: useWordSpans ? "normal" : "pre-wrap",
    wordBreak: useWordSpans ? "normal" : "break-word",
    overflowWrap: useWordSpans ? "normal" : "anywhere",
    textAlign: style.align,
    background: specialFill ? undefined : bg,
    padding: boxedInline
      ? `${boxPadY + opticalNudge}px ${boxPadX}px ${Math.max(0, boxPadY - opticalNudge)}px`
      : isBar
        ? `${px(Math.max(style.bgPaddingYPct, 1.2))}px ${px(style.bgPaddingXPct)}px`
        : "0",
    borderRadius: radius,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
    WebkitTextStrokeWidth: !specialFill && stroke > 0 ? `${stroke}px` : undefined,
    WebkitTextStrokeColor: !specialFill && stroke > 0 ? style.outlineColor : undefined,
    paintOrder: "stroke fill",
    textShadow: buildTextShadow(style, scale, prism || ember),
    mixBlendMode: negative ? "difference" : undefined,
    opacity: isGhost ? 0.45 : 1,
    cursor: onPositionChange ? "ns-resize" : undefined,
    userSelect: "none",
    touchAction: "none",
  };

  if (useAtelier) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const focus = kineticFocusIndex(tokens.length, filled);
      const layout = atelierLayout(tokens.length, focus);
      const variant = atelierVariant(tokens.length, focus);
      const baseFs = px(style.fontSizePct);
      const gap = px(kineticGapPct(style.fontSizePct) * 0.65);
      const accent = style.highlightColor || "#2E90FF";
      const softWhite = hexToRgba(style.color, 0.72);
      const wordAt = (i: number) => applyTextCase(tokens[i]!.text, "lower");

      const softShadow = style.shadow
        ? `0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.55), 0 ${1 * scale}px ${2 * scale}px rgba(0,0,0,0.4)`
        : "none";

      const serifLine = (
        indices: number[],
        key: string,
        opts: {
          alignSelf?: "flex-start" | "center" | "flex-end";
          xEm?: number;
          color?: string;
          scaleMul?: number;
          italic?: boolean;
        } = {},
      ) =>
        indices.length === 0 ? null : (
          <span
            key={key}
            className="cap-kinetic-word"
            style={{
              display: "block",
              alignSelf: opts.alignSelf ?? "center",
              fontFamily: fontStack(ATELIER_SATELLITE_FONT),
              fontStyle: opts.italic === false ? "normal" : "italic",
              fontSize: baseFs * (opts.scaleMul ?? ATELIER_SATELLITE_SCALE),
              fontWeight: 400,
              color: opts.color ?? style.color,
              letterSpacing: "0.03em",
              lineHeight: 1.05,
              whiteSpace: "nowrap",
              transform: opts.xEm ? `translateX(${opts.xEm}em)` : undefined,
              textShadow: softShadow,
            }}
          >
            {indices.map((i) => wordAt(i)).join(" ")}
          </span>
        );

      const focusWord = (
        opts: {
          color?: string;
          scaleMul?: number;
          inPill?: boolean;
        } = {},
      ) => {
        const text = wordAt(layout.focus);
        const fs = baseFs * (opts.scaleMul ?? ATELIER_FOCUS_SCALE);
        const color = opts.color ?? accent;

        if (opts.inPill) {
          // Mixed type inside white rounded card + tilted grid sticker (Klickpin signature).
          const midStart = Math.max(1, Math.floor(text.length * 0.28));
          const midEnd = Math.min(text.length - 1, Math.ceil(text.length * 0.72));
          const left = text.slice(0, midStart);
          const mid = text.slice(midStart, midEnd);
          const right = text.slice(midEnd);
          const gridSize = Math.max(18, fs * 0.85);
          return (
            <span
              key={`pill-${focus}`}
              className="cap-atelier-pill cap-kinetic-word"
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 0,
                padding: `${px(0.55)}px ${px(1.4)}px`,
                borderRadius: Math.max(10, px(1.6)),
                background: "#FFFFFF",
                boxShadow: `0 ${3 * scale}px ${14 * scale}px rgba(0,0,0,0.28)`,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  width: gridSize,
                  height: gridSize,
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%) rotate(-28deg)",
                  borderRadius: 4,
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)",
                  backgroundSize: `${Math.max(4, 5 * scale)}px ${Math.max(4, 5 * scale)}px`,
                  backgroundColor: "#111111",
                  zIndex: 0,
                  pointerEvents: "none",
                }}
              />
              <span style={{ position: "relative", zIndex: 1, display: "inline-flex", alignItems: "baseline" }}>
                <span
                  style={{
                    fontFamily: fontStack(style.fontFamily),
                    fontWeight: 700,
                    fontSize: fs * 0.92,
                    color: accent,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {left}
                </span>
                <span
                  style={{
                    fontFamily: fontStack(ATELIER_SATELLITE_FONT),
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: fs * 0.95,
                    color: "#111111",
                    letterSpacing: "0.01em",
                    margin: "0 0.02em",
                  }}
                >
                  {mid}
                </span>
                <span
                  style={{
                    fontFamily: fontStack(style.fontFamily),
                    fontWeight: 700,
                    fontSize: fs * 0.92,
                    color: accent,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {right}
                </span>
              </span>
            </span>
          );
        }

        return (
          <span
            key={`focus-${focus}`}
            className="cap-kinetic-word"
            style={{
              display: "inline-block",
              fontFamily: fontStack(style.fontFamily),
              fontSize: fs,
              fontWeight: Math.max(700, style.fontWeight),
              color,
              letterSpacing: `${style.letterSpacingEm}em`,
              lineHeight: 0.95,
              whiteSpace: "nowrap",
              textShadow: softShadow,
              transition: "font-size 0.2s cubic-bezier(0.22, 1.15, 0.36, 1), color 0.15s ease",
            }}
          >
            {text}
          </span>
        );
      };

      const ruler = (
        <span
          key="ruler"
          aria-hidden
          className="cap-atelier-ruler"
          style={{
            display: "flex",
            alignItems: "center",
            alignSelf: layout.before.length ? "flex-start" : "center",
            width: "52%",
            maxWidth: px(style.maxWidthPct) * 0.5,
            marginBottom: gap * 0.4,
            transform: layout.before.length ? "translateX(0.2em)" : undefined,
          }}
        >
          <span
            style={{
              width: Math.max(5, 6 * scale),
              height: Math.max(5, 6 * scale),
              borderRadius: "50%",
              border: `${Math.max(1, 1.5 * scale)}px solid ${style.color}`,
              boxSizing: "border-box",
              position: "relative",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: "22%",
                borderRadius: "50%",
                background: style.color,
              }}
            />
          </span>
          <span
            style={{
              flex: 1,
              height: Math.max(1, 1.4 * scale),
              marginLeft: 5 * scale,
              background: hexToRgba(style.color, 0.9),
              borderRadius: 1,
              transformOrigin: "left center",
              animation: "capAtelierDraw 0.45s ease-out both",
            }}
          />
        </span>
      );

      let body: ReactNode = null;

      if (variant === "pill") {
        body = (
          <>
            {layout.before.length > 0 &&
              serifLine(layout.before, "before", { alignSelf: "center", scaleMul: 0.5 })}
            {focusWord({ inPill: true })}
          </>
        );
      } else if (variant === "cascade") {
        body = (
          <>
            {ruler}
            {focusWord({ scaleMul: ATELIER_FOCUS_SCALE })}
            {serifLine(layout.after.length ? layout.after : layout.before, "trail", {
              alignSelf: "flex-end",
              xEm: 0.55,
              color: softWhite,
              scaleMul: ATELIER_SATELLITE_SCALE,
            })}
          </>
        );
      } else if (variant === "overlap") {
        const prev = layout.focus > 0 ? layout.focus - 1 : null;
        const next = layout.focus < tokens.length - 1 ? layout.focus + 1 : null;
        body = (
          <span
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              width: "100%",
              minHeight: baseFs * 2.2,
            }}
          >
            {layout.before.length > 1 &&
              serifLine(layout.before.slice(0, -1), "lead", {
                alignSelf: "center",
                scaleMul: 0.38,
                color: softWhite,
              })}
            <span style={{ position: "relative", display: "grid", placeItems: "center" }}>
              {prev !== null && (
                <span
                  className="cap-kinetic-word"
                  style={{
                    position: "absolute",
                    fontFamily: fontStack(style.fontFamily),
                    fontWeight: 700,
                    fontSize: baseFs * 1.05,
                    color: hexToRgba(style.color, 0.28),
                    letterSpacing: "-0.04em",
                    transform: "translate(-0.35em, -0.15em)",
                    whiteSpace: "nowrap",
                    zIndex: 0,
                  }}
                >
                  {wordAt(prev)}
                </span>
              )}
              {focusWord({ color: style.color, scaleMul: 1.35 })}
              {next !== null && (
                <span
                  className="cap-kinetic-word"
                  style={{
                    marginTop: -baseFs * 0.35,
                    fontFamily: fontStack(style.fontFamily),
                    fontWeight: 700,
                    fontSize: baseFs * 1.15,
                    color: accent,
                    letterSpacing: "-0.03em",
                    whiteSpace: "nowrap",
                    zIndex: 0,
                    textShadow: softShadow,
                  }}
                >
                  {wordAt(next)}
                </span>
              )}
            </span>
          </span>
        );
      } else if (variant === "roll") {
        const active = layout.before.concat(layout.focus);
        const upcoming = layout.after;
        body = (
          <>
            <span
              className="cap-kinetic-word"
              style={{
                display: "block",
                fontFamily: fontStack(style.fontFamily),
                fontWeight: 700,
                fontSize: baseFs * ATELIER_ROLL_SCALE,
                color: style.color,
                letterSpacing: "0.12em",
                wordSpacing: "0.35em",
                lineHeight: 1.15,
                textShadow: softShadow,
              }}
            >
              {active.map((i) => wordAt(i)).join(" ")}
            </span>
            {upcoming.length > 0 && (
              <span
                className="cap-kinetic-word"
                style={{
                  display: "block",
                  marginTop: gap * 0.5,
                  fontFamily: fontStack(style.fontFamily),
                  fontWeight: 700,
                  fontSize: baseFs * ATELIER_ROLL_SCALE * 0.92,
                  color: hexToRgba(style.color, 0.45),
                  letterSpacing: "-0.02em",
                  lineHeight: 1.1,
                }}
              >
                {upcoming.map((i) => wordAt(i)).join(" ")}
              </span>
            )}
          </>
        );
      } else {
        // stack — bold focus + italic support (infatuated / With)
        const showRuler = tokens.length >= 3;
        body = (
          <>
            {showRuler && ruler}
            {serifLine(layout.before, "before", {
              alignSelf: "flex-start",
              xEm: -0.25,
              color: softWhite,
            })}
            {focusWord({
              color: focus % 2 === 0 ? style.color : accent,
              scaleMul: ATELIER_FOCUS_SCALE,
            })}
            {serifLine(layout.after, "after", {
              alignSelf: "center",
              scaleMul: 0.55,
            })}
          </>
        );
      }

      content = (
        <span
          className="cap-atelier"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap,
            width: "100%",
            pointerEvents: "none",
          }}
        >
          {body}
        </span>
      );
    }
  } else if (useRomance) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const focus = kineticFocusIndex(tokens.length, filled);
      const layout = romanceLayout(tokens.length, focus);
      const baseFs = px(style.fontSizePct);
      const gap = px(kineticGapPct(style.fontSizePct) * 0.35);
      const softShadow = style.shadow
        ? `0 ${2 * scale}px ${8 * scale}px rgba(0,0,0,0.55), 0 ${1 * scale}px ${2 * scale}px rgba(0,0,0,0.35)`
        : "none";

      const scriptLine = (
        indices: number[],
        key: string,
        opts: { rotateDeg?: number; yEm?: number } = {},
      ) =>
        indices.length === 0 ? null : (
          <span
            key={key}
            className="cap-kinetic-word"
            style={{
              display: "block",
              fontFamily: fontStack(ROMANCE_SCRIPT_FONT),
              fontSize: baseFs * ROMANCE_SCRIPT_SCALE,
              fontWeight: 400,
              color: style.color,
              letterSpacing: "0.02em",
              lineHeight: 0.9,
              whiteSpace: "nowrap",
              marginBottom: opts.yEm ? undefined : -gap * 0.6,
              marginTop: opts.yEm ? -gap * 0.4 : undefined,
              transform: `rotate(${opts.rotateDeg ?? -8}deg)`,
              textShadow: softShadow,
            }}
          >
            {indices.map((i) => applyTextCase(tokens[i]!.text, "lower")).join(" ")}
          </span>
        );

      const trailLine =
        layout.after.length === 0 ? null : layout.before.length > 0 ? (
          <span
            key="trail"
            className="cap-kinetic-word"
            style={{
              display: "block",
              fontFamily: fontStack(style.fontFamily),
              fontSize: baseFs * ROMANCE_TRAIL_SCALE,
              fontWeight: 500,
              color: style.color,
              letterSpacing: `${ROMANCE_TRAIL_TRACKING_EM}em`,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              marginTop: gap * 0.35,
              textShadow: softShadow,
            }}
          >
            {layout.after.map((i) => applyTextCase(tokens[i]!.text, "upper")).join(" ")}
          </span>
        ) : (
          scriptLine(layout.after, "after-script", { rotateDeg: 6, yEm: 0.2 })
        );

      content = (
        <span
          className="cap-romance"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
            width: "100%",
            pointerEvents: "none",
          }}
        >
          {scriptLine(layout.before, "before", { rotateDeg: -8 })}
          <span
            key={`focus-${focus}`}
            className="cap-kinetic-word"
            style={{
              display: "inline-block",
              fontFamily: fontStack(style.fontFamily),
              fontSize: baseFs * ROMANCE_FOCUS_SCALE,
              fontWeight: Math.max(700, style.fontWeight),
              color: style.color,
              letterSpacing: `${style.letterSpacingEm}em`,
              lineHeight: 0.92,
              whiteSpace: "nowrap",
              textShadow: softShadow,
              transition: "font-size 0.18s cubic-bezier(0.22, 1.15, 0.36, 1)",
            }}
          >
            {applyTextCase(tokens[layout.focus]!.text, "title")}
          </span>
          {trailLine}
        </span>
      );
    }
  } else if (useEditorial) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const focus = kineticFocusIndex(tokens.length, filled);
      const layout = editorialLayout(tokens.length, focus);
      const baseFs = px(style.fontSizePct);
      const gap = px(kineticGapPct(style.fontSizePct) * 0.7);
      const wordAt = (i: number) =>
        applyTextCase(tokens[i]!.text, caseMode === "sentence" && i > 0 ? "lower" : caseMode);

      const satellite = (
        indices: number[],
        key: string,
        alignSelf: "flex-start" | "center" | "flex-end",
        xNudgeEm: number,
      ) =>
        indices.length === 0 ? null : (
          <span
            key={key}
            className="cap-kinetic-word"
            style={{
              display: "block",
              alignSelf,
              fontFamily: fontStack(EDITORIAL_SATELLITE_FONT),
              fontStyle: "italic",
              fontSize: baseFs * EDITORIAL_SATELLITE_SCALE,
              fontWeight: 400,
              color: style.color,
              letterSpacing: "0.04em",
              lineHeight: 1.1,
              whiteSpace: "nowrap",
              transform: xNudgeEm ? `translateX(${xNudgeEm}em)` : undefined,
              textShadow: style.shadow
                ? `0 ${1 * scale}px ${3 * scale}px rgba(0,0,0,0.4)`
                : "none",
            }}
          >
            {indices.map((i) => wordAt(i)).join(" ")}
          </span>
        );

      const showRuler = layout.before.length > 0 || tokens.length >= 2;

      content = (
        <span
          className="cap-editorial"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap,
            width: "100%",
            pointerEvents: "none",
          }}
        >
          {showRuler && (
            <span
              aria-hidden
              style={{
                display: "flex",
                alignItems: "center",
                alignSelf: layout.before.length ? "flex-start" : "center",
                width: "58%",
                maxWidth: px(style.maxWidthPct) * 0.55,
                marginBottom: gap * 0.35,
                transform: layout.before.length ? "translateX(0.15em)" : undefined,
              }}
            >
              <span
                style={{
                  width: Math.max(5, 6 * scale),
                  height: Math.max(5, 6 * scale),
                  borderRadius: "50%",
                  background: style.color,
                  flexShrink: 0,
                  boxShadow: `0 0 ${4 * scale}px rgba(0,0,0,0.35)`,
                }}
              />
              <span
                style={{
                  flex: 1,
                  height: Math.max(1, 1.5 * scale),
                  marginLeft: 4 * scale,
                  background: hexToRgba(style.color, 0.85),
                  borderRadius: 1,
                }}
              />
            </span>
          )}
          {satellite(layout.before, "before", "flex-start", -0.35)}
          <span
            className="cap-kinetic-word"
            style={{
              display: "inline-block",
              fontFamily: fontStack(style.fontFamily),
              fontSize: baseFs * EDITORIAL_FOCUS_SCALE,
              fontWeight: style.fontWeight,
              color: style.highlightColor,
              letterSpacing: `${style.letterSpacingEm}em`,
              lineHeight: 1,
              whiteSpace: "nowrap",
              textShadow: buildTextShadow(style, scale, false),
              transition: "font-size 0.18s cubic-bezier(0.22, 1.15, 0.36, 1)",
            }}
          >
            {wordAt(layout.focus)}
          </span>
          {satellite(layout.after, "after", "flex-end", 0.45)}
        </span>
      );
    }
  } else if (useFlash) {
    // Flash punches the whole caption frame (respects Caption density), not one spoken word.
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const baseFs = px(style.fontSizePct);
      const emphasize = isEmphasisOn(style);
      content = (
        <span
          key={`${segment!.start}-flash`}
          className="cap-flash cap-kinetic-word"
          style={{
            display: "inline-block",
            fontFamily: fontStack(style.fontFamily),
            fontSize: baseFs * FLASH_SCALE,
            fontWeight: style.fontWeight,
            letterSpacing: `${style.letterSpacingEm}em`,
            lineHeight: 1.05,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            textShadow: buildTextShadow(style, scale, false),
            WebkitTextStrokeWidth: stroke > 0 ? `${stroke}px` : undefined,
            WebkitTextStrokeColor: stroke > 0 ? style.outlineColor : undefined,
            paintOrder: "stroke fill",
          }}
        >
          {tokens.map((tk, i) => {
            const word = applyTextCase(
              tk.text,
              caseMode === "sentence" && i > 0 ? "lower" : caseMode,
            );
            const color =
              emphasize && isEmphasizedWord(tk.text)
                ? style.highlightColor
                : style.color;
            return (
              <span key={`${tk.start}-${i}`} style={{ color }}>
                {word}
                {i < tokens.length - 1 ? " " : ""}
              </span>
            );
          })}
        </span>
      );
    }
  } else if (useHook) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const focus = kineticFocusIndex(tokens.length, filled);
      const layout = hookLayout(tokens.length, focus);
      const baseFs = px(style.fontSizePct);
      const gap = px(kineticGapPct(style.fontSizePct) * 0.85);
      const glow = style.glowStrength ?? 0;
      const wordAt = (i: number) =>
        applyTextCase(tokens[i]!.text, caseMode === "sentence" && i > 0 ? "lower" : caseMode);

      const satellite = (indices: number[], key: string) =>
        indices.length === 0 ? null : (
          <span
            key={key}
            className="cap-kinetic-word"
            style={{
              display: "block",
              fontFamily: fontStack(HOOK_SATELLITE_FONT),
              fontSize: baseFs * HOOK_SATELLITE_SCALE,
              fontWeight: 500,
              color: style.color,
              letterSpacing: "0.01em",
              lineHeight: 1.05,
              whiteSpace: "nowrap",
              textShadow: style.shadow
                ? `0 ${1 * scale}px ${3 * scale}px rgba(0,0,0,0.45)`
                : "none",
            }}
          >
            {indices.map((i) => wordAt(i)).join(" ")}
          </span>
        );

      const focusGlow =
        glow > 0
          ? [
              `0 0 ${glow * 2 * scale}px ${hexToRgba(style.glowColor || style.highlightColor, 0.95)}`,
              `0 0 ${glow * 5 * scale}px ${hexToRgba(style.glowColor || style.highlightColor, 0.65)}`,
              `0 0 ${glow * 10 * scale}px ${hexToRgba(style.glowColor || style.highlightColor, 0.35)}`,
            ].join(", ")
          : buildTextShadow(style, scale, false);

      content = (
        <span
          className="cap-hook"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap,
            width: "100%",
            pointerEvents: "none",
          }}
        >
          {satellite(layout.before, "before")}
          <span
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "center",
              gap: "0.28em",
              flexWrap: "nowrap",
            }}
          >
            <span
              className="cap-kinetic-word"
              style={{
                display: "inline-block",
                fontFamily: fontStack(style.fontFamily),
                fontSize: baseFs * HOOK_FOCUS_SCALE,
                fontWeight: style.fontWeight,
                color: style.highlightColor,
                letterSpacing: `${style.letterSpacingEm}em`,
                lineHeight: 1,
                whiteSpace: "nowrap",
                textShadow: focusGlow,
                transition: "font-size 0.2s cubic-bezier(0.22, 1.15, 0.36, 1)",
              }}
            >
              {wordAt(layout.focus)}
            </span>
            {layout.beside != null && (
              <span
                className="cap-kinetic-word"
                style={{
                  display: "inline-block",
                  fontFamily: fontStack(HOOK_SATELLITE_FONT),
                  fontSize: baseFs * HOOK_SATELLITE_SCALE,
                  fontWeight: 500,
                  color: style.color,
                  letterSpacing: "0.01em",
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                }}
              >
                {wordAt(layout.beside)}
              </span>
            )}
          </span>
          {satellite(layout.below, "below")}
        </span>
      );
    }
  } else if (useScatter) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const focus = kineticFocusIndex(tokens.length, filled);
      const poses = scatterPoses(tokens.length, focus);
      const baseFs = px(style.fontSizePct);
      content = (
        <span
          className="cap-scatter"
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            height: px(scatterStageHeightPct(style.fontSizePct)),
            overflow: "visible",
            pointerEvents: "none",
          }}
        >
          {tokens.map((tk, i) => {
            const pose = poses[i] ?? poses[0];
            const word = applyTextCase(
              tk.text,
              caseMode === "sentence" && i > 0 ? "lower" : caseMode,
            );
            return (
              // Outer: position only. Inner: size + opacity anim (never animate transform —
              // that used to wipe positions and hide words).
              <span
                key={`${tk.start}-${i}`}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${pose.xPct}%)`,
                  top: `calc(50% + ${px(pose.yPct)}px)`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <span
                  className="cap-kinetic-word"
                  style={{
                    display: "inline-block",
                    fontFamily: fontStack(style.fontFamily),
                    fontSize: baseFs * pose.scale,
                    fontWeight: style.fontWeight,
                    color: style.color,
                    letterSpacing: `${style.letterSpacingEm}em`,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                    textShadow: buildTextShadow(style, scale, false),
                    WebkitTextStrokeWidth: stroke > 0 ? `${stroke}px` : undefined,
                    WebkitTextStrokeColor: stroke > 0 ? style.outlineColor : undefined,
                    paintOrder: "stroke fill",
                    transition: "font-size 0.2s cubic-bezier(0.22, 1.15, 0.36, 1)",
                  }}
                >
                  {word}
                </span>
              </span>
            );
          })}
        </span>
      );
    }
  } else if (useKinetic) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      const focus = kineticFocusIndex(tokens.length, filled);
      const poses = kineticPoses(tokens.length, focus);
      const baseFs = px(style.fontSizePct);
      const gap = px(kineticGapPct(style.fontSizePct));
      content = (
        <span
          className="cap-kinetic"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap,
            width: "100%",
            pointerEvents: "none",
          }}
        >
          {tokens.map((tk, i) => {
            const pose = poses[i] ?? poses[0];
            const word = applyTextCase(
              tk.text,
              caseMode === "sentence" && i > 0 ? "lower" : caseMode,
            );
            const isFocus = i === focus;
            return (
              <span
                key={`${tk.start}-${i}`}
                className="cap-kinetic-word"
                style={{
                  display: "block",
                  fontFamily: fontStack(style.fontFamily),
                  fontSize: baseFs * pose.scale,
                  fontWeight: style.fontWeight,
                  color: style.color,
                  letterSpacing: `${style.letterSpacingEm}em`,
                  lineHeight: 1,
                  whiteSpace: "nowrap",
                  transform: pose.xEm ? `translateX(${pose.xEm}em)` : undefined,
                  textShadow: buildTextShadow(style, scale, false),
                  WebkitTextStrokeWidth: stroke > 0 ? `${stroke}px` : undefined,
                  WebkitTextStrokeColor: stroke > 0 ? style.outlineColor : undefined,
                  paintOrder: "stroke fill",
                  opacity: isFocus ? 1 : 0.92,
                  transition:
                    "font-size 0.2s cubic-bezier(0.22, 1.15, 0.36, 1), transform 0.2s ease, opacity 0.15s ease",
                }}
              >
                {word}
              </span>
            );
          })}
        </span>
      );
    }
  } else if (useKaraoke || useEmphasis) {
    const tokens = tokenizeSegment(segment!);
    if (tokens.length) {
      content = tokens.map((tk, i) => {
        const word =
          caseMode === "sentence"
            ? i === 0
              ? applyTextCase(tk.text, "sentence")
              : tk.text.toLowerCase()
            : applyTextCase(tk.text, caseMode);

        // Karaoke must win over keyword emphasis: otherwise Auto emphasis paints every
        // content word in the accent color and progressive fill looks like a no-op.
        let color = style.color;
        let opacity = 1;
        if (useKaraoke) {
          if (i < filled) {
            color = style.highlightColor;
          } else {
            color = style.color;
            opacity = 0.45;
          }
        } else if (useEmphasis && isEmphasizedWord(tk.text)) {
          color = style.highlightColor;
        }

        return (
          <span
            key={i}
            style={{
              color,
              opacity,
              // Intact word chip — gap between words comes from parent columnGap.
              display: "inline-block",
              flex: "0 0 auto",
              whiteSpace: "nowrap",
            }}
          >
            {word}
          </span>
        );
      });
    }
  }

  const anim =
    hasText && !dragging.current && !useKinetic && !useScatter && !useHook && !useAtelier
      ? animationClass(style)
      : "";
  const animKey = hasText
    ? `${segment!.start}-${style.animation}-${style.textEffect ?? "none"}-${useKinetic || useScatter || useHook || useEditorial || useAtelier ? filled : 0}`
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
        ) : ember && !isGhost ? (
          <span className="cap-ember" style={spanStyle}>
            {content}
          </span>
        ) : negative && !isGhost ? (
          <span className="cap-negative" style={spanStyle}>
            {content}
          </span>
        ) : useKinetic || useScatter || useHook ? (
          content
        ) : style.animation === "typewriter" && !isGhost ? (
          <span className="cap-typewriter-wrap" style={spanStyle}>
            <span className="cap-typewriter-inner">{content}</span>
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
        @keyframes capKineticIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes capPrismShimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes capTypewriter {
          from { max-width: 0; }
          to { max-width: 100%; }
        }
        @keyframes capEmberShimmer {
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
        .cap-anim-typewriter {
          animation: capFadeIn 0.2s ease-out both;
        }
        .cap-kinetic-word {
          animation: capKineticIn 0.28s cubic-bezier(0.22, 1.15, 0.36, 1) both;
        }
        @keyframes capAtelierDraw {
          from { transform: scaleX(0); opacity: 0.4; }
          to { transform: scaleX(1); opacity: 1; }
        }
        .cap-atelier-pill {
          animation: capPopIn 0.34s cubic-bezier(0.22, 1.2, 0.36, 1) both;
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
        .cap-ember {
          background-image: linear-gradient(
            90deg,
            #ffb347 0%,
            #ff6a00 35%,
            #ff3b30 70%,
            #ff1e56 100%
          );
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: capEmberShimmer 3.2s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(255, 59, 48, 0.45))
            drop-shadow(0 2px 4px rgba(0,0,0,0.35));
        }
        .cap-negative {
          color: #ffffff;
          -webkit-text-fill-color: #ffffff;
          mix-blend-mode: difference;
        }
        .cap-typewriter-wrap {
          display: inline-block;
          max-width: 100%;
        }
        .cap-typewriter-inner {
          display: inline-block;
          overflow: hidden;
          white-space: nowrap;
          max-width: 0;
          animation: capTypewriter 1.15s steps(22, end) both;
          border-right: 2px solid rgba(255,255,255,0.75);
          padding-right: 1px;
        }
      `}</style>
    </div>
  );
}
