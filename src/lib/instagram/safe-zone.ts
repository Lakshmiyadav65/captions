/**
 * Configurable Instagram Reels safe-zone geometry (percent of frame).
 * Tuned against a real iOS “Your reels” capture (Aug 2026) + Meta 2026 guidance.
 */
export type RectPct = {
  top: number;
  left: number;
  bottom: number;
  right: number;
};

export type CaptionVisibility = "safe" | "warning" | "danger";

export type InstagramSafeZoneConfig = {
  version: string;
  topUi: RectPct;
  rightRail: RectPct;
  bottomMeta: RectPct;
  safeBand: RectPct;
};

/** Chrome copy mirrored from a real Reels capture (spacing verification). */
export type InstagramMockContent = {
  username: string;
  tagline: string;
  description: string;
  likes: string;
  comments: string;
  shares: string;
  saves: string;
  views: string;
  avatarSrc: string;
  audioThumbSrc: string;
};

export const INSTAGRAM_MOCK_CONTENT: InstagramMockContent = {
  username: "lakshmi.builds",
  tagline: "AI creator",
  description: 'Comment "OPENAI" and I\'ll send you the …',
  likes: "84",
  comments: "24",
  shares: "15",
  saves: "11",
  views: "18.1K",
  avatarSrc: "/ig-preview/avatar.png",
  audioThumbSrc: "/ig-preview/audio-thumb.png",
};

/**
 * Obstruction map for a 9:16 phone frame (% of video).
 * Bottom ~30% and right ~14% match the captured Reels chrome.
 */
export const INSTAGRAM_SAFE_ZONE_V1: InstagramSafeZoneConfig = {
  version: "2",
  topUi: { top: 0, left: 0, bottom: 10, right: 100 },
  rightRail: { top: 34, left: 86, bottom: 86, right: 100 },
  bottomMeta: { top: 70, left: 0, bottom: 100, right: 84 },
  safeBand: { top: 14, left: 5, bottom: 62, right: 82 },
};

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function overlapArea(a: RectPct, b: RectPct): number {
  const top = Math.max(a.top, b.top);
  const left = Math.max(a.left, b.left);
  const bottom = Math.min(a.bottom, b.bottom);
  const right = Math.min(a.right, b.right);
  const w = right - left;
  const h = bottom - top;
  if (w <= 0 || h <= 0) return 0;
  return w * h;
}

function rectArea(r: RectPct): number {
  return Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);
}

export function estimateCaptionRectPct(
  style: {
    positionYPct: number;
    fontSizePct: number;
    lineHeight: number;
    maxWidthPct: number;
    align: "left" | "center" | "right";
    bgPaddingYPct?: number;
    boxMode?: string;
  },
  lineHint = 1.35,
): RectPct {
  const padY =
    style.boxMode && style.boxMode !== "none"
      ? Math.max(style.bgPaddingYPct ?? 0.8, 0.6) * 2
      : 0.4;
  const height = clamp(
    style.fontSizePct * style.lineHeight * lineHint + padY,
    4,
    40,
  );
  const width = clamp(style.maxWidthPct, 30, 96);
  const cy = clamp(style.positionYPct, 0, 100);
  const top = clamp(cy - height / 2, 0, 100 - height);
  const bottom = top + height;

  let left: number;
  if (style.align === "left") left = 4;
  else if (style.align === "right") left = 100 - width - 4;
  else left = (100 - width) / 2;

  left = clamp(left, 0, 100 - width);
  return { top, left, bottom, right: left + width };
}

export function evaluateCaptionVisibility(
  caption: RectPct,
  zones: InstagramSafeZoneConfig = INSTAGRAM_SAFE_ZONE_V1,
): CaptionVisibility {
  const area = rectArea(caption) || 1;
  const bottomHit = overlapArea(caption, zones.bottomMeta) / area;
  const rightHit = overlapArea(caption, zones.rightRail) / area;
  const topHit = overlapArea(caption, zones.topUi) / area;
  const obstructed = bottomHit + rightHit + topHit;
  const inSafe = overlapArea(caption, zones.safeBand) / area;

  if (obstructed >= 0.35 || bottomHit >= 0.28 || rightHit >= 0.25) return "danger";
  if (obstructed >= 0.12 || inSafe < 0.45) return "warning";
  return "safe";
}

export const VISIBILITY_COPY: Record<
  CaptionVisibility,
  { label: string; hint: string }
> = {
  safe: {
    label: "Caption looks safe",
    hint: "Clear of the main Reels UI areas.",
  },
  warning: {
    label: "Caption may overlap Instagram UI",
    hint: "Nudge it into the safe band for cleaner Reels.",
  },
  danger: {
    label: "Caption may be hidden",
    hint: "Likely covered by likes, username, or bottom meta.",
  },
};
