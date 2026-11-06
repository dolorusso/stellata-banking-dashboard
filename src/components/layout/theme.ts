"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "stellata-theme";
const CHANGE_EVENT = "stellata-theme-change";

/**
 * Runs synchronously in <head> before first paint, so there's no flash.
 * Light by default; dark only when the user chose it.
 * Must stay in sync with `currentTheme` below.
 */
export const themeInitScript = `(function(){try{document.documentElement.classList.toggle("dark",localStorage.getItem("${STORAGE_KEY}")==="dark")}catch(e){}})()`;

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function currentTheme(): Theme {
  return storedTheme() ?? "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function subscribe(onChange: () => void) {
  const handle = () => {
    applyTheme(currentTheme());
    onChange();
  };
  // "storage" keeps other open tabs in sync with the user's choice.
  window.addEventListener("storage", handle);
  window.addEventListener(CHANGE_EVENT, handle);
  return () => {
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
