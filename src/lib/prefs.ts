/**
 * Language and default-location preferences, kept in localStorage.
 *
 * This is a tiny external store rather than component state so React can read it
 * with `useSyncExternalStore`: the server snapshot is the neutral default, the
 * client snapshot is whatever was stored, and hydration stays clean without an
 * effect that re-sets state on mount.
 *
 * Both values are preferences, not secrets, and neither is sent anywhere except
 * as part of a chat request the user initiated.
 */

import type { ClientLocation, Language } from "./types";

const LANGUAGE_KEY = "weathergpt.language";
const LOCATION_KEY = "weathergpt.location";

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or a full quota: the preference just will not persist.
  }
}

function isLanguage(value: unknown): value is Language {
  return value === "auto" || value === "en" || value === "hi";
}

function isLocation(value: unknown): value is ClientLocation {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<ClientLocation>;
  return (
    typeof candidate.latitude === "number" &&
    Number.isFinite(candidate.latitude) &&
    typeof candidate.longitude === "number" &&
    Number.isFinite(candidate.longitude)
  );
}

export function readLanguage(): Language {
  const stored = read(LANGUAGE_KEY);
  return isLanguage(stored) ? stored : "auto";
}

/** Rendered on the server, where no preference is known yet. */
export function serverLanguage(): Language {
  return "auto";
}

export function writeLanguage(next: Language): void {
  write(LANGUAGE_KEY, next);
  emit();
}

// useSyncExternalStore compares snapshots by identity, so the parsed object is
// cached against the exact string it came from.
let cachedRaw: string | null = null;
let cachedLocation: ClientLocation | null = null;

export function readLocation(): ClientLocation | null {
  const raw = read(LOCATION_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    if (raw === null) {
      cachedLocation = null;
    } else {
      try {
        const parsed: unknown = JSON.parse(raw);
        cachedLocation = isLocation(parsed) ? parsed : null;
      } catch {
        cachedLocation = null;
      }
    }
  }
  return cachedLocation;
}

export function serverLocation(): ClientLocation | null {
  return null;
}

export function writeLocation(next: ClientLocation | null): void {
  write(LOCATION_KEY, next === null ? null : JSON.stringify(next));
  cachedRaw = read(LOCATION_KEY);
  cachedLocation = next;
  emit();
}
