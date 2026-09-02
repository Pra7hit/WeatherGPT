"use client";

import { useSyncExternalStore } from "react";

import { subscribeThemeClass } from "./useTheme";

/**
 * The resolved ink colour, for the two canvases.
 *
 * Canvas cannot read a CSS custom property, and this world has exactly one ink,
 * so the value is read off the document rather than hard-coded next to the
 * drawing code. It is a store read rather than state in an effect: the class on
 * <html> is set before paint, so the first snapshot is already the right colour
 * and there is no frame drawn in the wrong ink.
 */

/** `getSnapshot` must be cheap and return a stable value, so the resolved colour
 *  is cached against the class string that produced it and only recomputed when
 *  the inversion actually happens. One document, so module scope is the cache. */
let cachedClass: string | null = null;
let cachedInk = "#000000";

function readInk(): string {
  const root = document.documentElement;
  if (root.className === cachedClass) return cachedInk;
  const declared = getComputedStyle(root).getPropertyValue("--wg-ink").trim();
  cachedClass = root.className;
  cachedInk = declared || (root.classList.contains("dark") ? "#ffffff" : "#000000");
  return cachedInk;
}

/** Nothing is painted on the server, so the value only has to be a valid colour. */
function serverInk(): string {
  return "#000000";
}

export function useInk(): string {
  return useSyncExternalStore(subscribeThemeClass, readInk, serverInk);
}
