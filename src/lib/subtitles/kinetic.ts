// Premium Style 1: stacked kinetic captions — every word stays visible, focus word is
// bigger, others smaller, with a small vertical gap (Klickpin-style hierarchy).

export interface KineticWordPose {
  /** Multiplier on the base caption font size (1 = base). */
  scale: number;
  /** Slight horizontal nudge in em units (0 = centered). */
  xEm: number;
}

/**
 * Poses for a vertical stack (top → bottom, same order as spoken words).
 * Focus word is large; others stay readable (~0.55×) with a light side nudge.
 */
export function kineticPoses(wordCount: number, focus = 0): KineticWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  if (n === 1) {
    return [{ scale: 1.15, xEm: 0 }];
  }

  return Array.from({ length: n }, (_, i) => {
    const isFocus = i === f;
    // Alternate slight left/right so multi-word stacks still feel kinetic, not a flat column.
    const side = i % 2 === 0 ? -0.15 : 0.15;
    return {
      scale: isFocus ? 1.2 : 0.58,
      xEm: isFocus ? 0 : side,
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

/** Vertical gap between stacked words, as % of video height (small on purpose). */
export function kineticGapPct(fontSizePct: number): number {
  return Math.max(0.55, fontSizePct * 0.12);
}
