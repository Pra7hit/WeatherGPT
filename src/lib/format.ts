import type { Place } from "@/services/weather/types";

/** Pure display formatters. Shared by server card builders and client components. */

const DASH = "—";

export function describePlace(place: Place): string {
  return [place.name, place.admin1, place.country].filter(Boolean).join(", ");
}

export function round(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return DASH;
  return value.toFixed(digits).replace(/\.0+$/, "");
}

/** Numeric rounding, for computed values that must stay numbers in tool payloads. */
export function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function fmtTemp(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : `${Math.round(value)}°C`;
}

export function fmtPct(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : `${Math.round(value)}%`;
}

export function fmtWind(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : `${Math.round(value)} km/h`;
}

export function fmtMm(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : `${round(value, 1)} mm`;
}

export function fmtPressure(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : `${Math.round(value)} hPa`;
}

export function fmtVisibility(metres: number | null | undefined): string {
  if (metres === null || metres === undefined || !Number.isFinite(metres)) return DASH;
  return metres >= 1000 ? `${round(metres / 1000, 1)} km` : `${Math.round(metres)} m`;
}

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export function windDirection(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) return DASH;
  return COMPASS[Math.round((degrees % 360) / 22.5) % 16];
}

export function fmtUv(value: number | null | undefined): string {
  return value === null || value === undefined || !Number.isFinite(value)
    ? DASH
    : round(value, 1);
}

/** Stable-ish id for cards emitted during one response. */
export function cardId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
