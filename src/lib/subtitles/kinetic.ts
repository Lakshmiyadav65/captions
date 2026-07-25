// Premium Style 1 = stacked "kinetic".
// Premium Style 2 = scattered "scatter" (up/down + big/small).
// Premium Style 3 = neon "hook" (support lines + glowing keyword).

export interface KineticWordPose {
  /** Multiplier on the base caption font size (1 = base). */
  scale: number;
  /** Slight horizontal nudge in em units (0 = centered). Stack mode only. */
  xEm: number;
}

export interface ScatterWordPose {
  /** Multiplier on the base caption font size (1 = base). */
  scale: number;
  /** Horizontal offset from caption center, as % of video width. */
  xPct: number;
  /** Vertical offset from caption anchor, as % of video height. */
  yPct: number;
}

/**
 * Premium Style 1 — vertical stack. Focus word large; others ~0.58× with a light side nudge.
 */
export function kineticPoses(wordCount: number, focus = 0): KineticWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  if (n === 1) {
    return [{ scale: 1.15, xEm: 0 }];
  }

  return Array.from({ length: n }, (_, i) => {
    const isFocus = i === f;
    const side = i % 2 === 0 ? -0.15 : 0.15;
    return {
      scale: isFocus ? 1.2 : 0.58,
      xEm: isFocus ? 0 : side,
    };
  });
}

/**
 * Premium Style 2 — Klickpin scatter. Words sit at different X/Y with size hierarchy.
 * Vertical gaps stay tight so pairs like "on my" / "podcast" nearly touch (reference look).
 */
export function scatterPoses(wordCount: number, focus = 0): ScatterWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  if (n === 1) {
    return [{ scale: 1.2, xPct: 0, yPct: 0 }];
  }

  if (n === 2) {
    // Focus first: diagonal "that" / "every". Focus second: tight stack "on my" / "podcast".
    return f === 0
      ? [
          { scale: 1.22, xPct: -9, yPct: -2.0 },
          { scale: 0.52, xPct: 11, yPct: 2.4 },
        ]
      : [
          { scale: 0.5, xPct: 0, yPct: -2.8 },
          { scale: 1.22, xPct: 0, yPct: 2.2 },
        ];
  }

  if (n === 3) {
    // "you" / "know" / "the one" — compact scatter.
    const base: ScatterWordPose[] = [
      { scale: 1.0, xPct: -10, yPct: -4.5 },
      { scale: 0.48, xPct: 12, yPct: -0.5 },
      { scale: 1.1, xPct: -4, yPct: 4.0 },
    ];
    return base.map((p, i) =>
      i === f
        ? { ...p, scale: Math.max(p.scale, 1.18) }
        : { ...p, scale: Math.min(p.scale, 0.55) },
    );
  }

  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const isFocus = i === f;
    return {
      scale: isFocus ? 1.15 : col === 0 ? 0.6 : 0.48,
      xPct: col === 0 ? -10 - row : 10 + row,
      yPct: (row - 1) * 4.5 + (col === 0 ? -2 : 2.5),
    };
  });
}

/** Active word index from filled count (last spoken word), clamped. */
export function kineticFocusIndex(tokenCount: number, filled: number): number {
  if (tokenCount <= 0) return 0;
  if (filled <= 0) return 0;
  return Math.min(tokenCount - 1, filled - 1);
}

export function isKinetic(style: { animation?: string }): boolean {
  return style.animation === "kinetic";
}

export function isScatter(style: { animation?: string }): boolean {
  return style.animation === "scatter";
}

export function isHook(style: { animation?: string }): boolean {
  return style.animation === "hook";
}

/** Premium modes that need per-word fill tracking. */
export function isKineticMode(style: { animation?: string }): boolean {
  return isKinetic(style) || isScatter(style) || isHook(style);
}

/** Vertical gap between stacked words, as % of video height (Style 1 / 3). */
export function kineticGapPct(fontSizePct: number): number {
  return Math.max(0.55, fontSizePct * 0.12);
}

/** Scatter stage height (% of video) — compact now that yPct offsets are tight. */
export function scatterStageHeightPct(fontSizePct: number): number {
  return Math.max(fontSizePct * 3.2, 18);
}

/**
 * Premium Style 3 (hook) layout slices — matches the boho/Klickpin "After" reference:
 * support words above, neon keyword (+ optional next word beside), rest below.
 */
export function hookLayout(tokenCount: number, focus = 0): {
  before: number[];
  focus: number;
  beside: number | null;
  below: number[];
} {
  const n = Math.max(1, tokenCount);
  const f = ((focus % n) + n) % n;
  const before = Array.from({ length: f }, (_, i) => i);
  const after = Array.from({ length: n - f - 1 }, (_, i) => f + 1 + i);
  const beside = after.length >= 1 ? after[0]! : null;
  const below = after.length > 1 ? after.slice(1) : [];
  return { before, focus: f, beside, below };
}

/** Focus scale vs satellite scale for hook mode. */
export const HOOK_FOCUS_SCALE = 1.35;
export const HOOK_SATELLITE_SCALE = 0.48;
/** Prefer a serif for white support lines when available. */
export const HOOK_SATELLITE_FONT = "Instrument Serif";
