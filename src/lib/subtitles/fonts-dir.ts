import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

// Server-only: the directory of real TTF font files that libass (ffmpeg's `subtitles`
// filter) loads when burning captions into the video. The browser fonts installed via
// @fontsource ship only woff/woff2, which libass CANNOT read, so we bundle matching TTFs
// under ./assets/fonts (English + Telugu). Each file's internal family name matches a
// `family` in fonts.ts, so the font selected in the editor is the font burned into the
// MP4. Noto Sans Telugu is always present as the fallback so native Telugu script never
// renders as tofu.

/** Absolute path to the bundled TTF font directory (override with FONTS_DIR in Docker). */
export function fontsDir(): string {
  if (process.env.FONTS_DIR) return resolve(process.env.FONTS_DIR);

  const candidates = [
    join(process.cwd(), "assets", "fonts"),
    // Next/Vercel serverless sometimes resolves cwd to the function root one level up.
    join(process.cwd(), "..", "assets", "fonts"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return candidates[0]!;
}
