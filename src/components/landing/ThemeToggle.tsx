"use client";

import { useEffect, useState } from "react";

export type LandingTheme = "light" | "dark";

const STORAGE_KEY = "caplio-landing-theme";

function applyTheme(theme: LandingTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-landing-theme", theme);
  document.querySelectorAll(".landing-page").forEach((el) => {
    el.setAttribute("data-theme", theme);
  });
}

function readStoredTheme(): LandingTheme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    // ignore
  }
  return null;
}

function systemTheme(): LandingTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Sync theme onto landing roots + persist. Returns current theme + toggle. */
export function useLandingTheme() {
  const [theme, setTheme] = useState<LandingTheme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initial = readStoredTheme() ?? systemTheme();
    setTheme(initial);
    applyTheme(initial);
    setReady(true);
  }, []);

  const toggle = () => {
    const next: LandingTheme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
    applyTheme(next);
  };

  return { theme, toggle, ready };
}

/** Circular sun/moon control — same placement idea as FluxoCut’s header toggle. */
export function ThemeToggle() {
  const { theme, toggle, ready } = useLandingTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      data-ready={ready ? "true" : "false"}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20.2 14.1A8.2 8.2 0 0 1 9.9 3.8 7.4 7.4 0 1 0 20.2 14.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
