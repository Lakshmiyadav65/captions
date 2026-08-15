/** Max length of the basename (without .mp4). */
export const MAX_EXPORT_BASENAME = 120;

const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
const TRAVERSAL = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

export type FilenameValidation =
  | { ok: true; basename: string; filename: string }
  | { ok: false; error: string };

function stripMp4(value: string): string {
  return value.replace(/\.mp4$/i, "");
}

/**
 * Normalize a user-supplied export name into a safe basename (no extension).
 * Returns null when nothing usable remains.
 */
export function sanitizeExportBasename(raw: string): string | null {
  let name = raw.normalize("NFC").trim();
  name = stripMp4(name);
  if (!name || TRAVERSAL.test(name)) return null;
  name = name.replace(/\\/g, "/");
  if (name.includes("/")) {
    const parts = name.split("/").filter((part) => part && part !== "." && part !== "..");
    name = parts.pop() ?? "";
  }
  name = name.replace(INVALID_CHARS, "").replace(/\s+/g, " ").trim();
  name = name.replace(/^\.+/, "").replace(/\.+$/, "").trim();
  if (!name || name === "." || name === "..") return null;
  if (name.length > MAX_EXPORT_BASENAME) {
    name = name.slice(0, MAX_EXPORT_BASENAME).trim();
  }
  if (!name) return null;
  return name;
}

export function validateExportBasename(raw: string): FilenameValidation {
  const trimmed = raw.normalize("NFC").trim();
  if (!trimmed || !stripMp4(trimmed).trim()) {
    return { ok: false, error: "Please enter a valid file name." };
  }
  if (TRAVERSAL.test(trimmed) || /[\\/]/.test(stripMp4(trimmed))) {
    return { ok: false, error: "Please enter a valid file name." };
  }
  const basename = sanitizeExportBasename(trimmed);
  if (!basename) {
    return { ok: false, error: "Please enter a valid file name." };
  }
  return { ok: true, basename, filename: `${basename}.mp4` };
}

export function defaultExportBasename(originalName: string | null | undefined): string {
  const withoutExt = (originalName ?? "").replace(/\.[^.]+$/, "");
  return sanitizeExportBasename(withoutExt) ?? "my-captioned-video";
}

export function exportDownloadName(basename: string): string {
  const clean = sanitizeExportBasename(basename) ?? "my-captioned-video";
  return `${clean}.mp4`;
}

/** RFC 5987 Content-Disposition for the chosen download name. */
export function contentDispositionAttachment(filename: string): string {
  const safe = exportDownloadName(filename);
  const ascii = safe.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  const encoded = encodeURIComponent(safe).replace(/['()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
