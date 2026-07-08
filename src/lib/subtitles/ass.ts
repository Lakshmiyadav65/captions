import type { Segment } from "@/lib/transcription/types";
import type { SubtitleStyle } from "./style";
import { tokenizeSegment } from "./karaoke";

// ASS (Advanced SubStation Alpha) carries full styling, so an exported .ass reproduces
// the font, size, colors, outline, box and position seen in the live preview. We render
// against a fixed 1920x1080 canvas and express sizes as a share of that height.

const PLAY_W = 1920;
const PLAY_H = 1080;

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

function marginV(style: SubtitleStyle): number {
  if (style.positionYPct < 33) return Math.round((style.positionYPct / 100) * PLAY_H);
  if (style.positionYPct < 66) return 0;
  return Math.round(((100 - style.positionYPct) / 100) * PLAY_H);
}

export function toASS(segments: Segment[], style: SubtitleStyle): string {
  const fontSize = Math.round((style.fontSizePct / 100) * PLAY_H);
  const hasBox = style.backgroundOpacity > 0;
  const boxAlpha = Math.round((1 - style.backgroundOpacity) * 255);

  const borderStyle = hasBox ? 3 : 1;
  const outline = hasBox
    ? Math.max(2, Math.round((style.bgPaddingYPct / 100) * PLAY_H))
    : style.outlineWidth;
  const shadow = style.shadow ? 2 : 0;

  const base = assColor(style.color, 0);
  // For karaoke, PrimaryColour is the "sung"/filled color and SecondaryColour the
  // not-yet-spoken color; \k swaps Secondary -> Primary as each word is reached.
  const primary = style.karaoke ? assColor(style.highlightColor, 0) : base;
  const secondary = style.karaoke ? base : base;
  const outlineCol = hasBox
    ? assColor(style.backgroundColor, boxAlpha)
    : assColor(style.outlineColor, 0);
  const backCol = hasBox
    ? assColor(style.backgroundColor, boxAlpha)
    : assColor("#000000", 80);

  const align = alignmentCode(style);
  const mv = marginV(style);
  const marginLR = Math.round(((100 - style.maxWidthPct) / 2 / 100) * PLAY_W);
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
Style: Default,${style.fontFamily},${fontSize},${primary},${secondary},${outlineCol},${backCol},${bold},0,0,0,100,100,${spacing},0,${borderStyle},${outline},${shadow},${align},${marginLR},${marginLR},${mv},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = segments
    .map((s) => {
      const text = style.karaoke
        ? karaokeText(s, style)
        : (style.uppercase ? s.text.toUpperCase() : s.text).replace(/\r?\n/g, "\\N");
      return `Dialogue: 0,${assTime(s.start)},${assTime(s.end)},Default,,0,0,0,,${text}`;
    })
    .join("\n");

  return header + events + "\n";
}

/** Build a Dialogue line with `{\k…}` karaoke tags so each word fills in sync with speech. */
function karaokeText(seg: Segment, style: SubtitleStyle): string {
  const tokens = tokenizeSegment(seg);
  if (!tokens.length) {
    return (style.uppercase ? seg.text.toUpperCase() : seg.text).replace(/\r?\n/g, "\\N");
  }
  // \k values are centiseconds; each word's duration runs until the next word starts so
  // inter-word gaps stay in sync. A lead-in \k covers any silence before the first word.
  const cs = (sec: number) => Math.max(0, Math.round(sec * 100));
  let out = "";
  const lead = cs(tokens[0].start - seg.start);
  if (lead > 0) out += `{\\k${lead}}`;
  tokens.forEach((tk, i) => {
    const nextStart = i < tokens.length - 1 ? tokens[i + 1].start : tk.end;
    const word = style.uppercase ? tk.text.toUpperCase() : tk.text;
    out += `{\\k${cs(nextStart - tk.start)}}${word}`;
    if (i < tokens.length - 1) out += " ";
  });
  return out;
}
