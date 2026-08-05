"use client";

import { useEffect, useState } from "react";
import {
  applyAppTheme,
  persistTheme,
  readStoredTheme,
  systemTheme,
  type AppTheme,
} from "@/lib/theme";

/** Sync theme onto landing + console roots and persist. */
export function useAppTheme() {
  const [theme, setTheme] = useState<AppTheme>("dark");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme() ?? systemTheme();
    setTheme(initial);
    applyAppTheme(initial);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: AppTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    persistTheme(next);
    applyAppTheme(next);
  };

  const set = (next: AppTheme) => {
    setTheme(next);
    persistTheme(next);
    applyAppTheme(next);
  };

  return { theme, toggle, set, ready, isDark: theme === "dark" };
}

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.5A8.5 8.5 0 0110.5 4 7 7 0 1014.5 21a8.5 8.5 0 016.5-6.5z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ConsoleThemeToggle() {
  const { isDark, toggle, ready } = useAppTheme();

  return (
    <button
      type="button"
      className="tc-theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      data-ready={ready ? "true" : "false"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
