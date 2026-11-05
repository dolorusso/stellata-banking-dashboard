"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "stellata-theme";
const CHANGE_EVENT = "stellata-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs synchronously in <head> before first paint, so there's no flash. A saved
 * choice wins; on a first visit the OS preference is the starting point.
 * Must stay in sync with `currentTheme` below.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${STORAGE_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  return storedTheme() ?? (window.matchMedia(DARK_QUERY).matches ? "dark" : "light");
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const handle = () => {
    applyTheme(currentTheme());
    onChange();
  };
  // The OS preference only matters until the user picks a theme (see currentTheme).
  media.addEventListener("change", handle);
  window.addEventListener("storage", handle);
  window.addEventListener(CHANGE_EVENT, handle);
  return () => {
    media.removeEventListener("change", handle);
    window.removeEventListener("storage", handle);
    window.removeEventListener(CHANGE_EVENT, handle);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light" as const);

  const toggle = useCallback(() => {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): still apply for this session.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { theme, toggle };
}

/**
 * React Strict Mode (dev) resets <html> attributes on remount, wiping the class
 * set by the init script. Re-apply it before paint. No-op in production.
 */
export function ThemeSync() {
  useLayoutEffect(() => applyTheme(currentTheme()), []);
  return null;
}
