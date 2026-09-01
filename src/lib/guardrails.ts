import "server-only";

/**
 * Request guardrails for the API routes.
 *
 * Three things are being protected here, none of them exotic:
 *
 * 1. The Anthropic budget. A chat turn costs real money and runs up to six tool
 *    iterations, so an accidental loop in a client (or an open tab left
 *    retrying) must not be able to spend it. Hence a per-caller rate limit and a
 *    global in-flight cap.
 * 2. The request size. History is replayed on every turn, so an unbounded
 *    transcript would grow the prompt without bound.
 * 3. Text hygiene. Control characters and lone surrogates are stripped before
 *    anything reaches the model or an upstream provider.
 *
 * State is per-process and in-memory: correct for a single local instance, which
 * is what this MVP runs as. A multi-instance deployment would move the counters
 * to a shared store - the call sites would not change.
 */

/** Requests allowed per caller per window. */
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;
/** Chat streams allowed in flight across the whole process. */
const MAX_CONCURRENT_CHATS = 8;

/** Caps on one chat request. The client already trims history; this enforces it. */
export const LIMITS = {
  maxMessages: 40,
  maxTurnChars: 4000,
  maxTotalChars: 24_000,
} as const;

const hits = new Map<string, number[]>();
let inFlight = 0;

/**
 * A stable-enough caller identity. Behind a proxy the forwarded header is all we
 * have; locally every request collapses to one bucket, which is fine - the point
 * is to bound total spend, not to identify anyone.
 */
export function callerKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "local";
}

export interface RateVerdict {
  ok: boolean;
  /** Seconds to wait, for a Retry-After header. */
  retryAfter: number;
}

export function checkRateLimit(key: string, limit: number = RATE_LIMIT): RateVerdict {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS);

  if (recent.length >= limit) {
    const oldest = recent[0]!;
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((RATE_WINDOW_MS - (now - oldest)) / 1000) };
  }

  recent.push(now);
  hits.set(key, recent);

  // Opportunistic cleanup so idle callers do not accumulate forever.
  if (hits.size > 500) {
    for (const [existing, stamps] of hits) {
      if (stamps.every((stamp) => now - stamp >= RATE_WINDOW_MS)) hits.delete(existing);
    }
  }

  return { ok: true, retryAfter: 0 };
}

/** Reserves a chat slot. Returns a release function, or null when at capacity. */
export function acquireChatSlot(): (() => void) | null {
  if (inFlight >= MAX_CONCURRENT_CHATS) return null;
  inFlight += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inFlight -= 1;
  };
}

/** Control characters (tab and newline excepted) and unpaired surrogate halves. */
function isJunk(codePoint: number): boolean {
  if (codePoint === 9 || codePoint === 10) return false;
  if (codePoint < 32 || codePoint === 127) return true;
  // Iterating by code point means a valid pair is one value above 0xFFFF;
  // anything still inside the surrogate range is therefore a lone half.
  return codePoint >= 0xd800 && codePoint <= 0xdfff;
}

/**
 * Purely defensive text hygiene: keeps malformed input from reaching the model or
 * an upstream URL. It is not a content filter - the honesty rules that stop the
 * model misusing user text live in the system prompt.
 */
export function sanitizeText(value: string): string {
  let out = "";
  for (const char of value) {
    const codePoint = char.codePointAt(0);
    if (codePoint === undefined || isJunk(codePoint)) continue;
    out += char;
  }
  return collapseBlankLines(out).trim();
}

/** Three or more consecutive newlines collapse to a paragraph break. */
function collapseBlankLines(value: string): string {
  const NEWLINE = String.fromCharCode(10);
  const BREAK = NEWLINE + NEWLINE;
  let out = value;
  while (out.includes(BREAK + NEWLINE)) out = out.split(BREAK + NEWLINE).join(BREAK);
  return out;
}
