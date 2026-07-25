// Premium Style 1 kinetic layout: words sit at different vertical offsets and scales
// (some up / some down, some bigger / some smaller) — matching the Klickpin reference.

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
 * spoken) gets the largest scale; neighbors stay smaller and drift up/down/left/right.
 */
export function kineticPoses(wordCount: number, focus = 0): KineticWordPose[] {
  const n = Math.max(1, wordCount);
  const f = ((focus % n) + n) % n;

  // Hand-tuned templates from the reference (1fps frame study).
  if (n === 1) {
    return [{ scale: 1.15, xPct: 0, yPct: 0 }];
  }
  if (n === 2) {
    // "that every" / "on my" + big word: small lead-in above, big focus below — or swap.
    const a: KineticWordPose = { scale: 0.55, xPct: -2, yPct: -7 };
    const b: KineticWordPose = { scale: 1.25, xPct: 2, yPct: 5 };
    return f === 0
      ? [
          { scale: 1.25, xPct: -6, yPct: -5 },
          { scale: 0.55, xPct: 10, yPct: 6 },
        ]
      : [a, b];
  }
  if (n === 3) {
    // "you" / "know" / "the one" scatter
    const base: KineticWordPose[] = [
      { scale: 1.05, xPct: -14, yPct: -10 },
      { scale: 0.5, xPct: 16, yPct: -2 },
      { scale: 1.15, xPct: -8, yPct: 8 },
    ];
    return base.map((p, i) =>
      i === f ? { ...p, scale: Math.max(p.scale, 1.2) } : { ...p, scale: Math.min(p.scale, 0.65) },
    );
  }

  // 4+ words: zig-zag up/down with alternating size; focus word amplified.
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const isFocus = i === f;
    return {
      scale: isFocus ? 1.2 : col === 0 ? 0.7 : 0.5,
      xPct: col === 0 ? -12 - row * 2 : 12 + row * 2,
      yPct: (row - 1) * 7 + (col === 0 ? -3 : 4),
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
