// Dependency-free color helpers for the style analyzer: normalize whatever a vision model
// returns (#RGB, #RRGGBB, rgb(), a few color names) to #RRGGBB, and compare two colors
// perceptually via CIE76 ΔE in Lab space (so "#fee" and "#ffeeee" agree, and near-blacks
// count as similar). Used by the converter and by the deterministic similarity metric.

const NAMED: Record<string, string> = {
  white: "#FFFFFF",
  black: "#000000",
  red: "#FF0000",
  green: "#008000",
  lime: "#00FF00",
  blue: "#0000FF",
  yellow: "#FFFF00",
  orange: "#FFA500",
  pink: "#FFC0CB",
  purple: "#800080",
  gray: "#808080",
  grey: "#808080",
  cyan: "#00FFFF",
  magenta: "#FF00FF",
};

/** Normalize a loose color string to "#RRGGBB", or null if unparseable. */
export function normalizeHex(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();

  if (NAMED[s]) return NAMED[s];

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(s);
  if (rgb) {
    const to = (n: string) => Math.max(0, Math.min(255, parseInt(n, 10)));
    return rgbToHex(to(rgb[1]), to(rgb[2]), to(rgb[3]));
  }

  let h = s.replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(h)) h = h.split("").map((c) => c + c).join("");
  if (/^[0-9a-f]{6}$/.test(h)) return `#${h.toUpperCase()}`;

  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${(h(r) + h(g) + h(b)).toUpperCase()}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  // sRGB -> linear
  const lin = (c: number) => {
    c /= 255;
    return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
  };
  const R = lin(r), G = lin(g), B = lin(b);
  // linear RGB -> XYZ (D65)
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

/** CIE76 color difference. ~0 identical, ~2.3 just-noticeable, 100+ very different. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = rgbToLab(...hexToRgb(a));
  const [l2, a2, b2] = rgbToLab(...hexToRgb(b));
  return Math.sqrt((l1 - l2) ** 2 + (a1 - a2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Agreement between two (possibly absent) colors, 0..1. Both absent -> 1 (they agree there's
 * no color); one absent -> 0; both present -> perceptual similarity (ΔE up to ~55 -> 0).
 */
export function colorAgreement(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const na = normalizeHex(a);
  const nb = normalizeHex(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  return 1 - Math.min(1, deltaE(na, nb) / 55);
}
