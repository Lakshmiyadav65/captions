import { join, resolve } from "node:path";

// Server-only: the directory of real TTF font files that libass (ffmpeg's `subtitles`
// filter) loads when burning captions into the video. The browser fonts installed via
// @fontsource ship only woff/woff2, which libass CANNOT read, so we bundle matching TTFs
// under ./assets/fonts. Each file's internal family name matches a `family` in fonts.ts,
// so the font selected in the editor is the font burned into the MP4. Noto Sans Telugu is
// always present as the fallback so native Telugu script never renders as tofu.

/** Absolute path to the bundled TTF font directory (override with FONTS_DIR in Docker). */
export function fontsDir(): string {
  return process.env.FONTS_DIR
    ? resolve(process.env.FONTS_DIR)
    : join(process.cwd(), "assets", "fonts");
}
