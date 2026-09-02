/**
 * Time helpers.
 *
 * Open-Meteo returns "naive local" timestamps for the requested location, e.g.
 * "2026-09-01T14:00" with no offset. Formatting those with a timezone would
 * shift them a second time, so we parse them as UTC components and format with
 * `timeZone: "UTC"` - which renders the digits exactly as the API sent them.
 */

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

function asUtcDate(naive: string): Date | null {
  const match = NAIVE.exec(naive.trim());
  if (!match) {
    const parsed = new Date(naive);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const [, y, m, d, hh = "00", mm = "00"] = match;
  return new Date(
    Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)),
  );
}

function localeFor(language: string): string {
  return language === "hi" ? "hi-IN" : "en-IN";
}

/**
 * 24-hour, always. Every other clock in the interface - the header, the turn
 * stamps, the retrieval times - is `hourCycle: "h23"`, and an axis that read
 * "8:00 PM" next to a header showing 20:35 would look like two devices.
 */
export function hourLabel(naive: string, language = "en"): string {
  const date = asUtcDate(naive);
  if (!date) return naive;
  return new Intl.DateTimeFormat(localeFor(language), {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

export function dayLabel(naive: string, language = "en"): string {
  const date = asUtcDate(naive);
  if (!date) return naive;
  return new Intl.DateTimeFormat(localeFor(language), {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function dateTimeLabel(naive: string, language = "en"): string {
  const date = asUtcDate(naive);
  if (!date) return naive;
  return new Intl.DateTimeFormat(localeFor(language), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
}

/** YYYY-MM-DD for a Date, in the given IANA timezone. */
export function isoDateInZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = asUtcDate(isoDate);
  if (!date) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** A rich "now" description for the model's volatile context block. */
export function describeNow(timeZone: string): string {
  const now = new Date();
  const formatted = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(now);
  return `${formatted} (${timeZone}); ISO date ${isoDateInZone(now, timeZone)}`;
}

export function isValidTimeZone(timeZone: string | undefined): boolean {
  if (!timeZone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    return true;
  } catch {
    return false;
  }
}
