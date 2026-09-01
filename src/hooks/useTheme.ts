"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Dark mode as a `dark` class on <html>, persisted to localStorage.
 *
 * The class is applied before paint by the inline script in layout.tsx, so the
 * DOM - not React state - is the source of truth. This hook subscribes to that
 * class with a MutationObserver, which means there is no flash, no hydration
 * mismatch, and no state to keep in sync: `apply` toggles the class and the
 * subscription re-renders whoever is reading it.
 */

const STORAGE_KEY = "weathergpt.theme";

export type Theme = "light" | "dark";

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** On the server the class does not exist yet, so the theme is genuinely unknown. */
function serverTheme(): null {
  return null;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, readTheme, serverTheme);

  const apply = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode or a full quota: the theme just will not persist.
    }
  }, []);

  const toggle = useCallback(() => {
    apply(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [apply]);

  return { theme: theme ?? "light", ready: theme !== null, toggle, setTheme: apply };
}
