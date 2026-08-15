import type { Segment } from "@/lib/transcription/types";
import {
  applyTextCase,
  effectiveBoxMode,
  effectiveTextCase,
  hasBackgroundBox,
  joinWithTextCase,
  type SubtitleStyle,
} from "./style";
import { isEmphasisOn, isEmphasizedWord } from "./emphasis";
import { tokenizeSegment } from "./karaoke";
import {
  ATELIER_FOCUS_SCALE,
  ATELIER_ROLL_SCALE,
  ATELIER_SATELLITE_SCALE,
  atelierLayout,
  atelierVariant,
  EDITORIAL_FOCUS_SCALE,
  EDITORIAL_SATELLITE_SCALE,
  editorialLayout,
  FLASH_SCALE,
  HOOK_FOCUS_SCALE,
  HOOK_SATELLITE_SCALE,
  hookLayout,
  isAtelier,
  isEditorial,
  isFlash,
  isHook,
  isKinetic,
  isPinterest,
  isPinterest3,
  isPinterest4,
  isRomance,
  isScatter,
  isShamani,
  kineticPoses,
  PINTEREST_FONT,
  PINTEREST_SUPPORT_SCALE,
  PINTEREST3_AFTER_SCALE,
  PINTEREST3_FONT,
  PINTEREST3_SUPPORT_SCALE,
  PINTEREST4_AFTER_SCALE,
  PINTEREST4_HERO_SCALE,
  PINTEREST4_SANS,
  PINTEREST4_SERIF,
  PINTEREST4_SUPPORT_SCALE,
  pinterest3FitScale,
  pinterest3Lockup,
  pinterest4FitScale,
  pinterest4Lockup,
  pinterestFitScale,
  pinterestLockup,
  ROMANCE_FOCUS_SCALE,
  ROMANCE_SCRIPT_FONT,
  ROMANCE_SCRIPT_SCALE,
  ROMANCE_TRAIL_SCALE,
  ROMANCE_TRAIL_TRACKING_EM,
  captionFitScaleMany,
  romanceDisplayWord,
  romanceFitScale,
  romanceLockup,
  romanceTokenFill,
  scatterPoses,
  SHAMANI_BODY_FONT,
  SHAMANI_BODY_SCALE,
  SHAMANI_FOCUS_WIDTH_PCT,
  SHAMANI_HEADER_FONT,
  SHAMANI_REVEAL_LAG_SEC,
  shamaniFitScale,
  shamaniReveal,
} from "./kinetic";

// ASS (Advanced SubStation Alpha) carries full styling, so an exported .ass reproduces
// the font, size, colors, outline, box and position seen in the live preview. The canvas
// (PlayResX/Y) is set to the real video dimensions when known so libass doesn't stretch
// text on portrait/square footage; it falls back to 1920x1080 for the plain .ass download.
// Glow / pill radius / full-bleed bars are approximated (ASS limits); preview remains richer.

const DEFAULT_PLAY_W = 1920;
const DEFAULT_PLAY_H = 1080;

/**
 * CSS `font-size` is the em-square; libass ASS `Fontsize` is OS/2 win ascent+descent.
 * Same numeric value therefore burns smaller than the preview. Multiply CSS px by this
 * per-family factor (measured from assets/fonts TTFs) so export matches the editor.
 * See https://github.com/libass/libass/issues/644
 */
const ASS_FS_FACTOR: Record<string, number> = {
  Anton: 1.733,
  Arimo: 1.432,
  "Bebas Neue": 1.3,
  Dhurjati: 1.851,
  Geist: 1.35,
  Gidugu: 1.854,
  "Instrument Serif": 1.3,
  Inter: 1.43,
  Mallanna: 1.849,
  Mandali: 1.977,
  Manrope: 1.366,
  Montserrat: 1.562,
  "Noto Sans Telugu": 1.478,
  NTR: 2.12,
  "Open Sans": 1.442,
  Oswald: 1.702,
  Outfit: 1.26,
  Poppins: 1.762,
  Ramaraja: 1.713,
  Roboto: 1.319,
  Suranna: 2.19,
};

const DEFAULT_ASS_FS_FACTOR = 1.45;

/** CSS px (em-square) → ASS Fontsize for the given family. */
function assFontSizePx(cssPx: number, family: string): number {
  const factor = ASS_FS_FACTOR[family] ?? DEFAULT_ASS_FS_FACTOR;
  return Math.max(8, Math.round(cssPx * factor));
}

/** Preview-equivalent CSS size for `fontSizePct` at a given PlayRes height. */
function cssFontPx(style: SubtitleStyle, playH: number): number {
  return (style.fontSizePct / 100) * playH;
}

/** ASS Fontsize matching the live preview for this style + frame height. */
function styleAssFontSize(style: SubtitleStyle, playH: number): number {
  return assFontSizePx(cssFontPx(style, playH), style.fontFamily);
}

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

/** ASS uses centiseconds: H:MM:SS.cc */
export function assTime(sec: number): string {
  const t = Math.max(0, sec);
  const cs = Math.round((t - Math.floor(t)) * 100);
  const h = Math.floor(t / 3600);
  return `${h}:${pad2((t / 60) % 60)}:${pad2(t % 60)}.${pad2(cs)}`;
}

/** #RRGGBB + alpha byte (0=opaque, 255=transparent) -> &HAABBGGRR */
function assColor(hex: string, alpha = 0): string {
  const h = hex.replace("#", "").padEnd(6, "0");
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  const a = Math.max(0, Math.min(255, alpha)).toString(16).padStart(2, "0");
  return `&H${a}${b}${g}${r}`.toUpperCase();
}

function alignmentCode(style: SubtitleStyle): number {
  const horiz = style.align === "left" ? 1 : style.align === "right" ? 3 : 2;
  if (style.positionYPct < 33) return horiz + 6; // top row (7-9)
  if (style.positionYPct < 66) return horiz + 3; // middle row (4-6)
  return horiz; // bottom row (1-3)
}

function marginV(style: SubtitleStyle, playH: number): number {
  if (style.positionYPct < 33) return Math.round((style.positionYPct / 100) * playH);
  if (style.positionYPct < 66) return 0;
  return Math.round(((100 - style.positionYPct) / 100) * playH);
}

/**
 * Absolute caption anchor matching the live preview (`top: positionYPct%` + translateY(-50%)).
 * Prefer \\pos over Style MarginV — Dialogue lines were overriding margins to 0, and
 * premium burns hard-coded \\an5 (dead center), so exports ignored drag/Top/Bottom.
 */
function anchorPoint(
  style: SubtitleStyle,
  playW: number,
  playH: number,
): { x: number; y: number; an: number } {
  const pct = Math.min(95, Math.max(5, style.positionYPct ?? 50));
  const y = Math.round((pct / 100) * playH);
  if (style.align === "left") {
    return { x: Math.round(((100 - style.maxWidthPct) / 2 / 100) * playW), y, an: 4 };
  }
  if (style.align === "right") {
    return {
      x: Math.round(playW - ((100 - style.maxWidthPct) / 2 / 100) * playW),
      y,
      an: 6,
    };
  }
  return { x: Math.round(playW / 2), y, an: 5 };
}

/** Shrink captions so the longest word still fits in the frame (preview + burn). */
function assFitScale(
  texts: string[],
  fontPx: number,
  playW: number,
  maxWidthPct: number,
): number {
  const maxW = playW * (Math.min(maxWidthPct || 90, 92) / 100);
  return captionFitScaleMany(texts, fontPx, maxW);
}

function fittedBaseFs(
  style: SubtitleStyle,
  playH: number,
  playW: number,
  words: string[],
  renderMul = 1,
): number {
  const base = styleAssFontSize(style, playH);
  return base * assFitScale(words, base * renderMul, playW, style.maxWidthPct);
}

/** Merge \\an/\\pos with entrance (and optional extra) override tags into one block. */
function overrideBlock(
  style: SubtitleStyle,
  playW: number,
  playH: number,
  extra = "",
): string {
  const { x, y, an } = anchorPoint(style, playW, playH);
  const enter = entranceTags(style).replace(/^\{|\}$/g, "");
  const bits = [`\\an${an}`, `\\pos(${x},${y})`, enter, extra].filter(Boolean);
  return `{${bits.join("")}}`;
}

/** Prefix ASS override tags for entrance animation (fade / pop). */
function entranceTags(style: SubtitleStyle): string {
  switch (style.animation) {
    case "fade":
      return "{\\fad(80,120)}";
    case "pop":
      // Brief scale-up from 90% → 100% so the word is readable immediately.
      return "{\\fscx90\\fscy90\\t(0,140,\\fscx100\\fscy100)}";
    case "kinetic":
      return "{\\fad(70,80)}";
    case "scatter":
      return "{\\fad(70,80)}";
    case "hook":
      return "{\\fad(70,80)}";
    case "flash":
      // Snappy scale pop on each caption frame (density controls word count).
      return "{\\fscx88\\fscy88\\t(0,120,\\fscx100\\fscy100)}";
    case "editorial":
      return "{\\fad(80,100)}";
    case "atelier":
      return "{\\fad(70,80)\\fscx94\\fscy94\\t(0,140,\\fscx100\\fscy100)}";
    case "romance":
      return "{\\fad(70,80)\\fscx94\\fscy94\\t(0,140,\\fscx100\\fscy100)}";
    case "shamani":
      return "{\\fad(70,80)}";
    case "pinterest":
      return "{\\fad(80,100)}";
    case "pinterest3":
      return "{\\fad(80,100)}";
    case "pinterest4":
      return "{\\fad(80,100)}";
    default:
      return "";
  }
}

export function toASS(
  segments: Segment[],
  style: SubtitleStyle,
  dims?: { width: number; height: number },
): string {
  const PLAY_W = dims?.width ?? DEFAULT_PLAY_W;
  const PLAY_H = dims?.height ?? DEFAULT_PLAY_H;
  const cssPx = cssFontPx(style, PLAY_H);
  const fontSize = styleAssFontSize(style, PLAY_H);
  const boxMode = effectiveBoxMode(style);
  const showBox = hasBackgroundBox(style);
  const isBar = boxMode === "bar" && showBox;
  const boxAlpha = Math.round((1 - style.backgroundOpacity) * 255);
  const glow = style.glowStrength ?? 0;
  const effect = style.textEffect ?? "none";
  const prism = effect === "prism";
  const ember = effect === "ember";
  const negative = effect === "negative";

  const borderStyle = showBox ? 3 : 1;

  // Boxes: BorderStyle 3 uses Outline as pad. Bars get extra vertical pad to read as a band.
  // Glow (no box): inflate outline + tint outline to glow color as a neon approximation.
  // Prism: soft frosted white + cool outline (ASS can't do iridescent glass).
  // Ember: warm orange/red fill (ASS can't do fire gradients).
  // Negative: bright white (difference blend is preview-only).
  let outline: number;
  let outlineCol: string;
  let shadow: number;
  let backCol: string;
  let primaryColor: string;
  let secondaryColor: string;

  if (showBox) {
    const padY = isBar
      ? Math.max(style.bgPaddingYPct, 2.2)
      : style.bgPaddingYPct;
    outline = Math.max(2, Math.round((padY / 100) * PLAY_H));
    outlineCol = assColor(style.backgroundColor, boxAlpha);
    backCol = assColor(style.backgroundColor, boxAlpha);
    shadow = style.shadow ? 2 : 0;
    const base = assColor(style.color, 0);
    primaryColor = style.karaoke ? assColor(style.highlightColor, 0) : base;
    secondaryColor = style.karaoke ? base : base;
  } else if (prism) {
    outline = Math.max(2, style.outlineWidth || 2);
    outlineCol = assColor("#C8D8F0", 40);
    backCol = assColor("#A8C4FF", 100);
    shadow = 3;
    // Near-white frosted fill — best ASS stand-in for glass.
    primaryColor = assColor("#F5F8FF", 20);
    secondaryColor = primaryColor;
  } else if (ember) {
    outline = Math.max(2, style.outlineWidth || 2);
    outlineCol = assColor("#FF6A00", 50);
    backCol = assColor("#FF3B30", 120);
    shadow = 3;
    primaryColor = assColor("#FF6A00", 0);
    secondaryColor = assColor("#FF3B30", 0);
  } else if (negative) {
    outline = Math.max(1, style.outlineWidth);
    outlineCol = assColor("#000000", 0);
    backCol = assColor("#000000", 80);
    shadow = style.shadow ? 2 : 0;
    primaryColor = assColor("#FFFFFF", 0);
    secondaryColor = primaryColor;
  } else if (isShamani(style)) {
    // Soft black drop-shadow only — keep captions readable without a heavy halo.
    outline = 0;
    outlineCol = assColor("#000000", 0);
    backCol = assColor("#000000", 60);
    shadow = 2;
    primaryColor = assColor(style.color, 0);
    secondaryColor = primaryColor;
  } else if (glow > 0) {
    outline = Math.max(style.outlineWidth, Math.round(glow * 1.5));
    outlineCol = assColor(style.glowColor || style.color, 60);
    backCol = assColor(style.glowColor || style.color, 120);
    shadow = Math.max(style.shadow ? 2 : 0, Math.round(glow / 2));
    const base = assColor(style.color, 0);
    primaryColor = style.karaoke ? assColor(style.highlightColor, 0) : base;
    secondaryColor = style.karaoke ? base : base;
  } else {
    outline = style.outlineWidth;
    outlineCol = assColor(style.outlineColor, 0);
    backCol = assColor("#000000", 80);
    shadow = style.shadow ? 2 : 0;
    const base = assColor(style.color, 0);
    primaryColor = style.karaoke ? assColor(style.highlightColor, 0) : base;
    secondaryColor = style.karaoke ? base : base;
  }

  // Bar: tighter left/right margins so the opaque box reads wider (band-like).
  const maxW = isBar
    ? Math.max(style.maxWidthPct, 96)
    : isShamani(style)
      ? Math.min(style.maxWidthPct || SHAMANI_FOCUS_WIDTH_PCT, SHAMANI_FOCUS_WIDTH_PCT)
      : style.maxWidthPct;
  const marginLR = Math.round(((100 - maxW) / 2 / 100) * PLAY_W);
  const bold = style.fontWeight >= 600 ? -1 : 0;
  const spacing = Math.round(style.letterSpacingEm * cssPx);

  const header = `[Script Info]
Title: Telugu Captions
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
PlayResX: ${PLAY_W}
PlayResY: ${PLAY_H}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily},${fontSize},${primaryColor},${secondaryColor},${outlineCol},${backCol},${bold},0,0,0,100,100,${spacing},0,${borderStyle},${outline},${shadow},${alignmentCode(style)},${marginLR},${marginLR},${marginV(style, PLAY_H)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = segments
    .flatMap((s) => {
      const plainFx = !prism && !ember && !negative;
      if (isAtelier(style) && plainFx) {
        return atelierDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isRomance(style) && plainFx) {
        return romanceDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isShamani(style) && plainFx) {
        return shamaniDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isPinterest(style) && plainFx) {
        return pinterestDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isPinterest3(style) && plainFx) {
        return pinterest3Dialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isPinterest4(style) && plainFx) {
        return pinterest4Dialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isEditorial(style) && plainFx) {
        return editorialDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isFlash(style) && plainFx) {
        return flashDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isHook(style) && plainFx) {
        return hookDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isScatter(style) && plainFx) {
        return scatterDialogues(s, style, PLAY_W, PLAY_H);
      }
      if (isKinetic(style) && plainFx) {
        return kineticDialogues(s, style, PLAY_W, PLAY_H);
      }
      let body: string;
      if (style.karaoke && plainFx) {
        body = karaokeText(s, style);
      } else if (isEmphasisOn(style) && plainFx) {
        body = emphasisText(s, style);
      } else {
        body = applyTextCase(s.text, effectiveTextCase(style)).replace(/\r?\n/g, "\\N");
      }
      const fit = assFitScale(
        s.text.split(/\s+/).filter(Boolean),
        cssPx,
        PLAY_W,
        style.maxWidthPct,
      );
      const fitTag = fit < 0.995 ? `\\fs${Math.round(fontSize * fit)}` : "";
      return [
        `Dialogue: 0,${assTime(s.start)},${assTime(s.end)},Default,,0,0,0,,${overrideBlock(style, PLAY_W, PLAY_H, fitTag)}${body}`,
      ];
    })
    .join("\n");

  return header + events + "\n";
}

/**
 * Premium Style 1 burn: stacked lines with per-word \\fs so every word stays visible
 * and the spoken word reads larger (matches the live flex stack).
 */
function kineticDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, effectiveTextCase(style)).replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const caseMode = effectiveTextCase(style);
  const baseFs = fittedBaseFs(
    style,
    playH,
    playW,
    tokens.map((t) => t.text),
    1.22,
  );
  const lines: string[] = [];

  tokens.forEach((tk, focus) => {
    const poses = kineticPoses(tokens.length, focus);
    const t0 = tk.start;
    const t1 = focus < tokens.length - 1 ? tokens[focus + 1].start : seg.end;
    if (t1 <= t0) return;

    const body = tokens
      .map((wordTk, i) => {
        const pose = poses[i] ?? poses[0];
        const word =
          caseMode === "sentence" && i > 0
            ? wordTk.text.toLowerCase()
            : applyTextCase(wordTk.text, caseMode);
        const fs = Math.max(8, Math.round(baseFs * pose.scale));
        const xScale = pose.xEm === 0 ? 100 : pose.xEm < 0 ? 98 : 102;
        return `{\\fs${fs}\\fscx${xScale}\\fscy100}${word}`;
      })
      .join("\\N");

    lines.push(
      `Dialogue: 0,${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${prefix}${body}`,
    );
  });

  return lines;
}

/**
 * Premium Style 2 burn: one Dialogue per word with \\pos + \\fs (Klickpin scatter).
 */
function scatterDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, effectiveTextCase(style)).replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,{\\fad(70,80)}${body}`];
  }

  const caseMode = effectiveTextCase(style);
  const baseFs = fittedBaseFs(
    style,
    playH,
    playW,
    tokens.map((t) => t.text),
    1.22,
  );
  const anchorY = (style.positionYPct / 100) * playH;
  const lines: string[] = [];

  tokens.forEach((tk, focus) => {
    const poses = scatterPoses(tokens.length, focus);
    const t0 = tk.start;
    const t1 = focus < tokens.length - 1 ? tokens[focus + 1].start : seg.end;
    if (t1 <= t0) return;

    tokens.forEach((wordTk, i) => {
      const pose = poses[i] ?? poses[0];
      const word =
        caseMode === "sentence" && i > 0
          ? wordTk.text.toLowerCase()
          : applyTextCase(wordTk.text, caseMode);
      const x = Math.round(playW / 2 + (pose.xPct / 100) * playW);
      const y = Math.round(anchorY + (pose.yPct / 100) * playH);
      const fs = Math.max(8, Math.round(baseFs * pose.scale));
      const tags = `{\\an5\\pos(${x},${y})\\fs${fs}\\fad(70,60)}`;
      lines.push(
        `Dialogue: ${i},${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${tags}${word}`,
      );
    });
  });

  return lines;
}

/**
 * Styles 3.0 Atelier burn — blue/white mixed hierarchy approximating the Klickpin look.
 */
function atelierDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, "lower").replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const baseFs = fittedBaseFs(
    style,
    playH,
    playW,
    tokens.map((t) => t.text),
    ATELIER_FOCUS_SCALE,
  );
  const satFs = Math.max(8, Math.round(baseFs * ATELIER_SATELLITE_SCALE));
  const focusFs = Math.max(10, Math.round(baseFs * ATELIER_FOCUS_SCALE));
  const rollFs = Math.max(8, Math.round(baseFs * ATELIER_ROLL_SCALE));
  const white = assColor(style.color, 0);
  const blue = assColor(style.highlightColor, 0);
  const lines: string[] = [];

  const wordAt = (i: number) => applyTextCase(tokens[i]!.text, "lower");

  tokens.forEach((tk, focus) => {
    const layout = atelierLayout(tokens.length, focus);
    const variant = atelierVariant(tokens.length, focus);
    const t0 = tk.start;
    const t1 = focus < tokens.length - 1 ? tokens[focus + 1]!.start : seg.end;
    if (t1 <= t0) return;

    const parts: string[] = [];
    if (variant === "roll") {
      const active = layout.before.concat(layout.focus);
      parts.push(`{\\c${white}\\fs${rollFs}\\b1}${active.map(wordAt).join(" ")}{\\b0}`);
      if (layout.after.length) {
        parts.push(`{\\c${white}\\fs${Math.round(rollFs * 0.9)}\\alpha&H80&}${layout.after.map(wordAt).join(" ")}`);
      }
    } else if (variant === "pill") {
      if (layout.before.length) {
        parts.push(`{\\c${white}\\fs${satFs}\\i1}${layout.before.map(wordAt).join(" ")}{\\i0}`);
      }
      parts.push(`{\\c${blue}\\fs${focusFs}\\b1}${wordAt(layout.focus)}{\\b0}`);
    } else if (variant === "cascade") {
      parts.push(`{\\c${blue}\\fs${focusFs}\\b1}${wordAt(layout.focus)}{\\b0}`);
      const trail = layout.after.length ? layout.after : [];
      if (trail.length) {
        parts.push(`{\\c${white}\\fs${satFs}\\i1}${trail.map(wordAt).join(" ")}{\\i0}`);
      }
    } else if (variant === "overlap") {
      if (layout.focus > 0) {
        parts.push(`{\\c${white}\\fs${Math.round(baseFs)}\\alpha&H90&}${wordAt(layout.focus - 1)}`);
      }
      parts.push(`{\\c${white}\\fs${focusFs}\\b1}${wordAt(layout.focus)}{\\b0}`);
      if (layout.focus < tokens.length - 1) {
        parts.push(`{\\c${blue}\\fs${Math.round(baseFs * 1.1)}\\b1}${wordAt(layout.focus + 1)}{\\b0}`);
      }
    } else {
      if (layout.before.length) {
        parts.push(`{\\c${white}\\fs${satFs}\\i1}${layout.before.map(wordAt).join(" ")}{\\i0}`);
      }
      const focusCol = focus % 2 === 0 ? white : blue;
      parts.push(`{\\c${focusCol}\\fs${focusFs}\\b1}${wordAt(layout.focus)}{\\b0}`);
      if (layout.after.length) {
        parts.push(`{\\c${white}\\fs${Math.round(satFs * 1.2)}\\i1}${layout.after.map(wordAt).join(" ")}{\\i0}`);
      }
    }

    lines.push(
      `Dialogue: 0,${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${prefix}${parts.join("\\N")}`,
    );
  });

  return lines;
}

/**
 * Styles 3.0 Telugu Connects burn: static lockup with karaoke / Auto emphasis colors.
 * Karaoke slices time so spoken words fill with the accent; layout never rearranges.
 */
function romanceDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, "title").replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const layout = romanceLockup(tokens.map((tk) => tk.text));
  const baseFs0 = styleAssFontSize(style, playH);
  const soloScript = layout.solo === "script";
  const heroText = applyTextCase(
    romanceDisplayWord(tokens[layout.focus]!.text),
    soloScript ? "lower" : "title",
  );
  const scriptText = layout.before
    .map((i) => applyTextCase(romanceDisplayWord(tokens[i]!.text), "lower"))
    .join(" ");
  const afterText = layout.after
    .map((i) =>
      applyTextCase(
        romanceDisplayWord(tokens[i]!.text),
        layout.afterStyle === "trail" ? "upper" : "lower",
      ),
    )
    .join(" ");
  const fit = romanceFitScale({
    hero: heroText,
    heroFontPx: baseFs0 * (soloScript ? ROMANCE_SCRIPT_SCALE * 1.35 : ROMANCE_FOCUS_SCALE),
    heroTrackingEm: soloScript ? 0.02 : style.letterSpacingEm,
    script: scriptText,
    scriptFontPx: baseFs0 * ROMANCE_SCRIPT_SCALE,
    trail: layout.afterStyle === "trail" ? afterText : "",
    trailFontPx: baseFs0 * ROMANCE_TRAIL_SCALE,
    trailTrackingEm: ROMANCE_TRAIL_TRACKING_EM,
    maxWidthPx: playW * (Math.min(style.maxWidthPct, 92) / 100),
  });
  const baseFs = baseFs0 * fit;
  const scriptFs = Math.max(8, Math.round(baseFs * ROMANCE_SCRIPT_SCALE));
  const focusFs = Math.max(10, Math.round(baseFs * ROMANCE_FOCUS_SCALE));
  const trailFs = Math.max(7, Math.round(baseFs * ROMANCE_TRAIL_SCALE));
  const baseCol = assColor(style.color, 0);
  const accentCol = assColor(style.highlightColor, 0);
  const dimCol = assColor(style.color, 0x80);
  const scriptFn = ROMANCE_SCRIPT_FONT;
  const focusFn = style.fontFamily;
  const trailSpacing = Math.round(ROMANCE_TRAIL_TRACKING_EM * trailFs);

  const colorFor = (i: number, filled: number) => {
    const fill = romanceTokenFill(i, tokens[i]!.text, filled, style);
    if (fill === "accent") return accentCol;
    if (fill === "dim") return dimCol;
    return baseCol;
  };

  const wordAt = (i: number, mode: "lower" | "upper" | "title") =>
    applyTextCase(romanceDisplayWord(tokens[i]!.text), mode);

  const lockupText = (filled: number) => {
    const parts: string[] = [];
    if (layout.before.length) {
      const text = layout.before
        .map((i) => `{\\c${colorFor(i, filled)}}${wordAt(i, "lower")}`)
        .join(" ");
      parts.push(`{\\fn${scriptFn}\\fs${scriptFs}\\b0}${text}`);
    }
    if (soloScript) {
      parts.push(
        `{\\fn${scriptFn}\\fs${Math.round(scriptFs * 1.35)}\\b0\\c${colorFor(layout.focus, filled)}}${wordAt(layout.focus, "lower")}`,
      );
    } else {
      parts.push(
        `{\\fn${focusFn}\\fs${focusFs}\\b1\\c${colorFor(layout.focus, filled)}}${wordAt(layout.focus, "title")}`,
      );
    }
    if (layout.after.length) {
      if (layout.afterStyle === "trail") {
        const text = layout.after
          .map((i) => `{\\c${colorFor(i, filled)}}${wordAt(i, "upper")}`)
          .join(" ");
        parts.push(`{\\fn${focusFn}\\fs${trailFs}\\b0\\fsp${trailSpacing}}${text}`);
      } else {
        const text = layout.after
          .map((i) => `{\\c${colorFor(i, filled)}}${wordAt(i, "lower")}`)
          .join(" ");
        parts.push(`{\\fn${scriptFn}\\fs${scriptFs}\\b0}${text}`);
      }
    }
    return parts.join("\\N");
  };

  if (!style.karaoke) {
    return [
      `Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${lockupText(tokens.length)}`,
    ];
  }

  return tokens.flatMap((tk, i) => {
    const t0 = tk.start;
    const t1 = i < tokens.length - 1 ? tokens[i + 1]!.start : seg.end;
    if (t1 <= t0) return [];
    return [
      `Dialogue: 0,${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${prefix}${lockupText(i + 1)}`,
    ];
  });
}

/**
 * Raj Shamani burn: first 4 words lock as Oswald caps; remaining on Inter
 * lowercase at 50%. Stay inside the 80% focus band (10% | 80% | 10%).
 * Light black shadow only.
 */
function shamaniDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH, "\\bord0\\shad2");
  if (!tokens.length) {
    const body = applyTextCase(seg.text, "upper").replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const reveal0 = shamaniReveal(tokens.length, tokens.length);
  const bodyCase = effectiveTextCase(style);
  const headerFull = tokens
    .slice(0, reveal0.headerCount)
    .map((t) => applyTextCase(t.text, "upper"))
    .join(" ");
  const bodyFull = joinWithTextCase(
    tokens.slice(reveal0.headerCount).map((t) => t.text),
    bodyCase,
  );

  const baseFs0 = styleAssFontSize({ ...style, fontFamily: SHAMANI_HEADER_FONT }, playH);
  const focusPct = Math.min(style.maxWidthPct || SHAMANI_FOCUS_WIDTH_PCT, SHAMANI_FOCUS_WIDTH_PCT);
  const maxW = playW * (focusPct / 100);
  const fit = shamaniFitScale({
    header: headerFull,
    body: bodyFull,
    baseFontPx: baseFs0,
    maxWidthPx: maxW,
  });
  const baseFs = Math.max(10, Math.round(baseFs0 * fit));
  const bodyFs = Math.max(7, Math.round(baseFs * SHAMANI_BODY_SCALE));
  const accentCol = assColor(style.highlightColor, 0);
  const whiteCol = assColor(style.color, 0);

  const lockupText = (filled: number) => {
    const reveal = shamaniReveal(tokens.length, filled);
    const parts: string[] = [];
    if (reveal.headerShown > 0) {
      const text = tokens
        .slice(0, reveal.headerShown)
        .map((t) => applyTextCase(t.text, "upper"))
        .join(" ");
      parts.push(
        `{\\fn${SHAMANI_HEADER_FONT}\\fs${baseFs}\\b0\\c${accentCol}\\bord0\\shad2}${text}`,
      );
    }
    if (reveal.bodyShown > 0) {
      const text = joinWithTextCase(
        tokens
          .slice(reveal.headerCount, reveal.headerCount + reveal.bodyShown)
          .map((t) => t.text),
        bodyCase,
      );
      parts.push(
        `{\\fn${SHAMANI_BODY_FONT}\\fs${bodyFs}\\b0\\c${whiteCol}\\bord0\\shad2}${text}`,
      );
    }
    return parts.join("\\N");
  };

  const lines: string[] = [];
  const lag = SHAMANI_REVEAL_LAG_SEC;
  tokens.forEach((tk, i) => {
    const t0 = tk.start + lag;
    const t1 = i < tokens.length - 1 ? tokens[i + 1]!.start + lag : seg.end;
    const start = Math.max(seg.start, Math.min(t0, t1 - 0.05));
    const end = Math.min(seg.end, Math.max(t1, start + 0.08));
    if (end <= start) return;
    lines.push(
      `Dialogue: 0,${assTime(start)},${assTime(end)},Default,,0,0,0,,${prefix}${lockupText(i + 1)}`,
    );
  });

  return lines;
}

/**
 * Pinterest 2 burn: small serif lead-in + oversized serif hero, all lowercase.
 * Hero fills with the accent once those words are spoken (karaoke).
 */
function pinterestDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH, "\\bord0\\shad0");
  if (!tokens.length) {
    const body = applyTextCase(seg.text, "lower").replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const layout = pinterestLockup(tokens.map((t) => t.text));
  const supportText = layout.support
    .map((i) => applyTextCase(tokens[i]!.text, "lower"))
    .join(" ");
  const heroText = layout.hero
    .map((i) => applyTextCase(tokens[i]!.text, "lower"))
    .join(" ");

  const baseFs0 = styleAssFontSize({ ...style, fontFamily: PINTEREST_FONT }, playH);
  const maxW = playW * (Math.min(style.maxWidthPct || 86, 88) / 100);
  const fit = pinterestFitScale({
    support: supportText,
    hero: heroText,
    baseFontPx: baseFs0,
    maxWidthPx: maxW,
  });
  const heroFs = Math.max(12, Math.round(baseFs0 * fit));
  const supportFs = Math.max(8, Math.round(heroFs * PINTEREST_SUPPORT_SCALE));
  const whiteCol = assColor(style.color, 0);
  const accentCol = assColor(style.highlightColor, 0);
  const fn = PINTEREST_FONT;

  const lockupText = (heroAccent: boolean) => {
    const parts: string[] = [];
    if (supportText) {
      parts.push(`{\\fn${fn}\\fs${supportFs}\\b0\\c${whiteCol}}${supportText}`);
    }
    if (heroText) {
      parts.push(
        `{\\fn${fn}\\fs${heroFs}\\b0\\c${heroAccent ? accentCol : whiteCol}}${heroText}`,
      );
    }
    return parts.join("\\N");
  };

  if (!style.karaoke || layout.hero.length === 0) {
    return [
      `Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${lockupText(false)}`,
    ];
  }

  const heroStart = tokens[layout.hero[0]!]!.start;
  const lines: string[] = [];
  if (heroStart > seg.start + 0.04) {
    lines.push(
      `Dialogue: 0,${assTime(seg.start)},${assTime(heroStart)},Default,,0,0,0,,${prefix}${lockupText(false)}`,
    );
  }
  lines.push(
    `Dialogue: 0,${assTime(Math.max(seg.start, heroStart))},${assTime(seg.end)},Default,,0,0,0,,${prefix}${lockupText(true)}`,
  );
  return lines;
}

/**
 * Pinterest 3 burn: staggered bold sans — small lead-in, huge hero, small trail.
 */
function pinterest3Dialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH, "\\bord0\\shad0");
  if (!tokens.length) {
    const body = applyTextCase(seg.text, "lower").replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const layout = pinterest3Lockup(tokens.map((t) => t.text));
  const wordAt = (i: number) =>
    applyTextCase(tokens[i]!.text, i === 0 ? "title" : "lower");
  const beforeText = layout.before.map(wordAt).join(" ");
  const heroText = layout.hero.map(wordAt).join(" ");
  const afterText = layout.after.map(wordAt).join(" ");

  const baseFs0 = styleAssFontSize({ ...style, fontFamily: PINTEREST3_FONT }, playH);
  const maxW = playW * (Math.min(style.maxWidthPct || 88, 90) / 100);
  const fit = pinterest3FitScale({
    before: beforeText,
    hero: heroText,
    after: afterText,
    baseFontPx: baseFs0,
    maxWidthPx: maxW,
  });
  const heroFs = Math.max(12, Math.round(baseFs0 * fit));
  const beforeFs = Math.max(8, Math.round(heroFs * PINTEREST3_SUPPORT_SCALE));
  const afterFs = Math.max(8, Math.round(heroFs * PINTEREST3_AFTER_SCALE));
  const white = assColor(style.color, 0);
  const ghost = assColor(style.color, 0xb0);
  const fn = PINTEREST3_FONT;

  const parts: string[] = [];
  if (layout.ghost && heroText) {
    parts.push(`{\\fn${fn}\\fs${heroFs}\\b1\\c${ghost}\\fsp-2}${heroText.toLowerCase()}`);
    if (beforeText) {
      parts.push(`{\\fn${fn}\\fs${beforeFs}\\b1\\c${white}}${beforeText}`);
    }
  } else {
    if (beforeText) {
      parts.push(`{\\fn${fn}\\fs${beforeFs}\\b1\\c${white}}${beforeText}`);
    }
    if (heroText) {
      parts.push(`{\\fn${fn}\\fs${heroFs}\\b1\\c${white}\\fsp-2}${heroText}`);
    }
    if (afterText) {
      parts.push(`{\\fn${fn}\\fs${afterFs}\\b1\\c${white}}${afterText}`);
    }
  }

  return [
    `Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${parts.join("\\N")}`,
  ];
}

/**
 * Pinterest 4 burn: bold sans stack + optional italic serif punch, white glow.
 * Lines appear as their words are spoken (same lockup as the preview).
 */
function pinterest4Dialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const glow = "\\bord2\\blur2\\shad0\\3c&H00FFFFFF&";
  const prefix = overrideBlock(style, playW, playH, glow);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, effectiveTextCase(style)).replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const layout = pinterest4Lockup(tokens.map((t) => t.text));
  const caseMode = effectiveTextCase(style);
  const wordAt = (i: number) =>
    applyTextCase(tokens[i]!.text, caseMode === "sentence" && i > 0 ? "lower" : caseMode);
  const join = (idxs: number[]) => idxs.map(wordAt).join(" ");
  const beforeAll = join(layout.before);
  const heroAll = join(layout.hero);
  const afterAll = join(layout.after);
  const compact = layout.before.length === 0 && layout.after.length === 0;

  const cssBase = cssFontPx({ ...style, fontFamily: PINTEREST4_SANS }, playH);
  const maxW = playW * (Math.min(style.maxWidthPct || 86, 88) / 100);
  const fit = pinterest4FitScale({
    before: beforeAll,
    hero: heroAll,
    after: afterAll,
    baseFontPx: cssBase,
    maxWidthPx: maxW,
  });
  const heroMul = compact ? 1 : PINTEREST4_HERO_SCALE;
  const beforeFs = assFontSizePx(cssBase * PINTEREST4_SUPPORT_SCALE * fit, PINTEREST4_SANS);
  const heroFs = assFontSizePx(cssBase * heroMul * fit, layout.serifHero ? PINTEREST4_SERIF : PINTEREST4_SANS);
  const afterFs = assFontSizePx(cssBase * PINTEREST4_AFTER_SCALE * fit, PINTEREST4_SANS);
  const white = assColor(style.color, 0);
  const sans = PINTEREST4_SANS;
  const serif = PINTEREST4_SERIF;

  const line = (kind: "before" | "hero" | "after", text: string): string => {
    if (kind === "before") {
      return `{\\fn${sans}\\fs${beforeFs}\\b1\\i0\\c${white}}${text}`;
    }
    if (kind === "hero") {
      return layout.serifHero
        ? `{\\fn${serif}\\fs${heroFs}\\b0\\i1\\c${white}}${text}`
        : `{\\fn${sans}\\fs${heroFs}\\b1\\i0\\c${white}}${text}`;
    }
    const ital = layout.serifHero ? "\\i1" : "\\i0";
    return `{\\fn${sans}\\fs${afterFs}\\b1${ital}\\c${white}}${text}`;
  };

  const lockupText = (shown: number) => {
    const vis = (idxs: number[]) => idxs.filter((i) => i < shown);
    const parts: string[] = [];
    const b = join(vis(layout.before));
    const h = join(vis(layout.hero));
    const a = join(vis(layout.after));
    if (b) parts.push(line("before", b));
    if (h) parts.push(line("hero", h));
    if (a) parts.push(line("after", a));
    return parts.join("\\N");
  };

  const lines: string[] = [];
  tokens.forEach((tk, i) => {
    const t0 = tk.start;
    const t1 = i < tokens.length - 1 ? tokens[i + 1]!.start : seg.end;
    if (t1 <= t0) return;
    const body = lockupText(i + 1);
    if (!body) return;
    lines.push(
      `Dialogue: 0,${assTime(Math.max(seg.start, t0))},${assTime(Math.min(seg.end, t1))},Default,,0,0,0,,${prefix}${body}`,
    );
  });
  return lines.length
    ? lines
    : [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${lockupText(tokens.length)}`];
}

/**
 * Premium Style 5 burn: blue sans focus + italic serif supports (ASS approx of editorial).
 */
function editorialDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, effectiveTextCase(style)).replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const caseMode = effectiveTextCase(style);
  const baseFs = fittedBaseFs(
    style,
    playH,
    playW,
    tokens.map((t) => t.text),
    EDITORIAL_FOCUS_SCALE,
  );
  const satFs = Math.max(8, Math.round(baseFs * EDITORIAL_SATELLITE_SCALE));
  const focusFs = Math.max(10, Math.round(baseFs * EDITORIAL_FOCUS_SCALE));
  const white = assColor(style.color, 0);
  const blue = assColor(style.highlightColor, 0);
  const lines: string[] = [];

  const wordAt = (i: number) => {
    const raw = tokens[i]!.text;
    return caseMode === "sentence" && i > 0
      ? raw.toLowerCase()
      : applyTextCase(raw, caseMode);
  };

  tokens.forEach((tk, focus) => {
    const layout = editorialLayout(tokens.length, focus);
    const t0 = tk.start;
    const t1 = focus < tokens.length - 1 ? tokens[focus + 1]!.start : seg.end;
    if (t1 <= t0) return;

    const parts: string[] = [];
    if (layout.before.length) {
      parts.push(
        `{\\c${white}\\fs${satFs}\\i1}${layout.before.map(wordAt).join(" ")}{\\i0}`,
      );
    }
    parts.push(`{\\c${blue}\\fs${focusFs}\\b1}${wordAt(layout.focus)}{\\b0}`);
    if (layout.after.length) {
      parts.push(
        `{\\c${white}\\fs${satFs}\\i1}${layout.after.map(wordAt).join(" ")}{\\i0}`,
      );
    }

    lines.push(
      `Dialogue: 0,${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${prefix}${parts.join("\\N")}`,
    );
  });

  return lines;
}

/**
 * Premium Style 4 burn: punchy scale pop on the full caption frame
 * (word count comes from Caption density — same as preview).
 */
function flashDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  // Flash scale pop lives in entranceTags; bump \\fs to match preview FLASH_SCALE.
  const prefix = overrideBlock(style, playW, playH);
  const caseMode = effectiveTextCase(style);
  const baseFs = fittedBaseFs(
    style,
    playH,
    playW,
    tokens.map((t) => t.text),
    FLASH_SCALE,
  );
  const fs = Math.max(10, Math.round(baseFs * FLASH_SCALE));
  const white = assColor(style.color, 0);
  const accent = assColor(style.highlightColor, 0);
  const useEmphasis = isEmphasisOn(style);

  if (!tokens.length) {
    const body = applyTextCase(seg.text, caseMode).replace(/\r?\n/g, "\\N");
    return [
      `Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}{\\fs${fs}\\c${white}}${body}`,
    ];
  }

  const body = tokens
    .map((tk, i) => {
      const word =
        caseMode === "sentence" && i > 0
          ? tk.text.toLowerCase()
          : applyTextCase(tk.text, caseMode);
      const col = useEmphasis && isEmphasizedWord(tk.text) ? accent : white;
      return `{\\c${col}}${word}`;
    })
    .join(" ");

  return [
    `Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}{\\fs${fs}}${body}`,
  ];
}

/**
 * Premium Style 3 burn: stacked hook — neon focus word, white support lines (ASS approx).
 */
function hookDialogues(
  seg: Segment,
  style: SubtitleStyle,
  playW: number,
  playH: number,
): string[] {
  const tokens = tokenizeSegment(seg);
  const prefix = overrideBlock(style, playW, playH);
  if (!tokens.length) {
    const body = applyTextCase(seg.text, effectiveTextCase(style)).replace(/\r?\n/g, "\\N");
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,${prefix}${body}`];
  }

  const caseMode = effectiveTextCase(style);
  const baseFs = fittedBaseFs(
    style,
    playH,
    playW,
    tokens.map((t) => t.text),
    HOOK_FOCUS_SCALE,
  );
  const satFs = Math.max(8, Math.round(baseFs * HOOK_SATELLITE_SCALE));
  const focusFs = Math.max(10, Math.round(baseFs * HOOK_FOCUS_SCALE));
  const white = assColor(style.color, 0);
  const neon = assColor(style.highlightColor, 0);
  const lines: string[] = [];

  const wordAt = (i: number) => {
    const raw = tokens[i]!.text;
    return caseMode === "sentence" && i > 0
      ? raw.toLowerCase()
      : applyTextCase(raw, caseMode);
  };

  tokens.forEach((tk, focus) => {
    const layout = hookLayout(tokens.length, focus);
    const t0 = tk.start;
    const t1 = focus < tokens.length - 1 ? tokens[focus + 1].start : seg.end;
    if (t1 <= t0) return;

    const parts: string[] = [];
    if (layout.before.length) {
      parts.push(
        `{\\c${white}\\fs${satFs}}${layout.before.map(wordAt).join(" ")}`,
      );
    }
    const mid = `{\\c${neon}\\fs${focusFs}\\b1}${wordAt(layout.focus)}{\\b0}`;
    if (layout.beside != null) {
      parts.push(
        `${mid} {\\c${white}\\fs${satFs}}${wordAt(layout.beside)}`,
      );
    } else {
      parts.push(mid);
    }
    if (layout.below.length) {
      parts.push(
        `{\\c${white}\\fs${satFs}}${layout.below.map(wordAt).join(" ")}`,
      );
    }

    lines.push(
      `Dialogue: 0,${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${prefix}${parts.join("\\N")}`,
    );
  });

  return lines;
}

/** Per-word accent colors via ASS `\\c` overrides (Tharun Speaks static emphasis). */
function emphasisText(seg: Segment, style: SubtitleStyle): string {
  const caseMode = effectiveTextCase(style);
  const tokens = tokenizeSegment(seg);
  if (!tokens.length) {
    return applyTextCase(seg.text, caseMode).replace(/\r?\n/g, "\\N");
  }
  const base = assColor(style.color, 0);
  const accent = assColor(style.highlightColor, 0);
  return tokens
    .map((tk, i) => {
      const word =
        caseMode === "sentence"
          ? i === 0
            ? applyTextCase(tk.text, "sentence")
            : tk.text.toLowerCase()
          : applyTextCase(tk.text, caseMode);
      const col = isEmphasizedWord(tk.text) ? accent : base;
      return `{\\c${col}}${word}`;
    })
    .join(" ");
}

/** Build a Dialogue line with `{\k…}` karaoke tags so each word fills in sync with speech. */
function karaokeText(seg: Segment, style: SubtitleStyle): string {
  const caseMode = effectiveTextCase(style);
  const tokens = tokenizeSegment(seg);
  if (!tokens.length) {
    return applyTextCase(seg.text, caseMode).replace(/\r?\n/g, "\\N");
  }
  const cs = (sec: number) => Math.max(0, Math.round(sec * 100));
  let out = "";
  const lead = cs(tokens[0].start - seg.start);
  if (lead > 0) out += `{\\k${lead}}`;
  tokens.forEach((tk, i) => {
    const nextStart = i < tokens.length - 1 ? tokens[i + 1].start : tk.end;
    const word =
      caseMode === "sentence"
        ? i === 0
          ? applyTextCase(tk.text, "sentence")
          : tk.text.toLowerCase()
        : applyTextCase(tk.text, caseMode);
    out += `{\\k${cs(nextStart - tk.start)}}${word}`;
    if (i < tokens.length - 1) out += " ";
  });
  return out;
}
