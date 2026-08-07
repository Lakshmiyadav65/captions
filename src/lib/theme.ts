export type AppTheme = "light" | "dark";

/** Shared across landing + console so one preference follows the user everywhere. */
export const THEME_STORAGE_KEY = "caplio-landing-theme";

export function applyAppTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-landing-theme", theme);
  document.documentElement.setAttribute("data-console-theme", theme);
  document.querySelectorAll(".landing-page").forEach((el) => {
    el.setAttribute("data-theme", theme);
  });
}

export function readStoredTheme(): AppTheme | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function systemTheme(): AppTheme {
  return "light";
}

export function persistTheme(theme: AppTheme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
