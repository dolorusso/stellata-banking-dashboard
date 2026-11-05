"use client";

import { useCallback, useLayoutEffect, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "stellata-theme";
const CHANGE_EVENT = "stellata-theme-change";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs synchronously in <head> before first paint so the correct theme is
 * applied with no flash. Must stay in sync with `applyTheme` below.
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}")||"system";var d=p==="dark"||(p==="system"&&matchMedia("${DARK_QUERY}").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`;

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function applyTheme(preference: ThemePreference) {
  const dark =
    preference === "dark" ||
    (preference === "system" && window.matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const handle = () => {
    applyTheme(readPreference());
    onChange();
  };
  media.addEventListener("change", handle);
  window.addEventListener("storage", handle);
  window.addEventListener(CHANGE_EVENT, handle);
  return () => {
    media.removeEventListener("change", handle);
    window.removeEventListener("storage", handle);
    window.removeEventListener(CHANGE_EVENT, handle);
  };
}

function resolvedSnapshot(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, () => "system" as const);
  const resolved = useSyncExternalStore(subscribe, resolvedSnapshot, () => "light" as const);

  const setPreference = useCallback((next: ThemePreference) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable (private mode): still apply for this session.
    }
    applyTheme(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { preference, resolved, setPreference };
}

/**
 * React Strict Mode (dev) resets <html> attributes on remount, wiping the class
 * set by the init script. Re-apply it before paint. No-op in production.
 */
export function ThemeSync() {
  useLayoutEffect(() => applyTheme(readPreference()), []);
  return null;
}
