// Premium Style 1 kinetic layout: words sit at different vertical offsets and scales
// (some up / some down, some bigger / some smaller) — matching the Klickpin reference.
//
// xPct / yPct are % of the *video frame* (not the caption box). Preview must convert
// yPct via the video-height px() helper or words collapse on top of each other.

export interface KineticWordPose {
  /** Multiplier on the base caption font size (1 = base). */
  scale: number;
  /** Horizontal offset from the caption center, as % of video width. */
  xPct: number;
  /** Vertical offset from the caption anchor, as % of video height. */
  yPct: number;
}

/**
 * Deterministic staggered poses for N words. `focus` (0-based, usually the word being
 * spoken) gets the largest scale; neighbors stay smaller and drift up/down with enough
 * gap that glyphs don't collide.
 */
export function kineticPoses(wordCount: number, focus = 0): KineticWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  if (n === 1) {
    return [{ scale: 1.12, xPct: 0, yPct: 0 }];
  }

  if (n === 2) {
    // Stacked pair with clear air between lines (was too tight in v1).
    const smallUp: KineticWordPose = { scale: 0.52, xPct: 0, yPct: -9 };
    const bigDown: KineticWordPose = { scale: 1.15, xPct: 0, yPct: 8 };
    const bigUp: KineticWordPose = { scale: 1.15, xPct: 0, yPct: -8 };
    const smallDown: KineticWordPose = { scale: 0.52, xPct: 0, yPct: 9 };
    return f === 0 ? [bigUp, smallDown] : [smallUp, bigDown];
  }

  if (n === 3) {
    const base: KineticWordPose[] = [
      { scale: 0.95, xPct: -18, yPct: -11 },
      { scale: 0.48, xPct: 18, yPct: -1 },
      { scale: 1.1, xPct: -6, yPct: 11 },
    ];
    return base.map((p, i) =>
      i === f
        ? { ...p, scale: Math.max(p.scale, 1.12) }
        : { ...p, scale: Math.min(p.scale, 0.58) },
    );
  }

  // 4+ words: zig-zag with wider vertical rhythm.
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const isFocus = i === f;
    return {
      scale: isFocus ? 1.12 : col === 0 ? 0.62 : 0.48,
      xPct: col === 0 ? -16 - row * 2 : 16 + row * 2,
      yPct: (row - 1) * 10 + (col === 0 ? -5 : 6),
    };
  });
}

/** Active word index from filled count (last spoken word), clamped. */
export function kineticFocusIndex(tokenCount: number, filled: number): number {
  if (tokenCount <= 0) return 0;
  if (filled <= 0) return 0;
  return Math.min(tokenCount - 1, filled - 1);
}

/** Whether this style should use the kinetic scatter renderer. */
export function isKinetic(style: { animation?: string }): boolean {
  return style.animation === "kinetic";
}

/** Max |yPct| used by layouts — sizes the preview kinetic stage. */
export function kineticStageHeightPct(fontSizePct: number): number {
  // Room for ±11% offsets + largest scaled glyph + padding.
  return Math.max(fontSizePct * 4.5, 28);
}
