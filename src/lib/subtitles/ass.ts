import type { Segment } from "@/lib/transcription/types";
import {
  applyTextCase,
  effectiveBoxMode,
  effectiveTextCase,
  hasBackgroundBox,
  type SubtitleStyle,
} from "./style";
import { isEmphasisOn, isEmphasizedWord } from "./emphasis";
import { tokenizeSegment } from "./karaoke";
import {
  EDITORIAL_FOCUS_SCALE,
  EDITORIAL_SATELLITE_SCALE,
  editorialLayout,
  FLASH_SCALE,
  HOOK_FOCUS_SCALE,
  HOOK_SATELLITE_SCALE,
  hookLayout,
  isEditorial,
  isFlash,
  isHook,
  isKinetic,
  isScatter,
  kineticPoses,
  scatterPoses,
} from "./kinetic";

// ASS (Advanced SubStation Alpha) carries full styling, so an exported .ass reproduces
// the font, size, colors, outline, box and position seen in the live preview. The canvas
// (PlayResX/Y) is set to the real video dimensions when known so libass doesn't stretch
// text on portrait/square footage; it falls back to 1920x1080 for the plain .ass download.
// Glow / pill radius / full-bleed bars are approximated (ASS limits); preview remains richer.

const DEFAULT_PLAY_W = 1920;
const DEFAULT_PLAY_H = 1080;

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
      return "{\\fad(200,150)}";
    case "pop":
      // Brief scale-up from 85% → 100% over ~300ms, then hold.
      return "{\\fscx85\\fscy85\\t(0,300,\\fscx100\\fscy100)}";
    case "kinetic":
      return "{\\fad(120,80)}";
    case "scatter":
      return "{\\fad(120,80)}";
    case "hook":
      return "{\\fad(120,80)}";
    case "flash":
      // Snappy scale pop on each caption frame (density controls word count).
      return "{\\fscx80\\fscy80\\t(0,160,\\fscx100\\fscy100)}";
    case "editorial":
      return "{\\fad(140,100)}";
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
  const fontSize = Math.round((style.fontSizePct / 100) * PLAY_H);
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
  const maxW = isBar ? Math.max(style.maxWidthPct, 96) : style.maxWidthPct;
  const marginLR = Math.round(((100 - maxW) / 2 / 100) * PLAY_W);
  const bold = style.fontWeight >= 600 ? -1 : 0;
  const spacing = Math.round(style.letterSpacingEm * fontSize);

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
      return [
        `Dialogue: 0,${assTime(s.start)},${assTime(s.end)},Default,,0,0,0,,${overrideBlock(style, PLAY_W, PLAY_H)}${body}`,
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
  const baseFs = Math.round((style.fontSizePct / 100) * playH);
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
    return [`Dialogue: 0,${assTime(seg.start)},${assTime(seg.end)},Default,,0,0,0,,{\\fad(120,80)}${body}`];
  }

  const caseMode = effectiveTextCase(style);
  const baseFs = Math.round((style.fontSizePct / 100) * playH);
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
      const tags = `{\\an5\\pos(${x},${y})\\fs${fs}\\fad(100,60)}`;
      lines.push(
        `Dialogue: ${i},${assTime(t0)},${assTime(t1)},Default,,0,0,0,,${tags}${word}`,
      );
    });
  });

  return lines;
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
  const baseFs = Math.round((style.fontSizePct / 100) * playH);
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
  const baseFs = Math.round((style.fontSizePct / 100) * playH);
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
  const baseFs = Math.round((style.fontSizePct / 100) * playH);
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
