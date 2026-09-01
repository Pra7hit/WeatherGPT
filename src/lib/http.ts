/**
 * Shared fetch helper.
 *
 * Services return `Result<T>` instead of throwing, so an upstream outage becomes
 * a value the AI layer can honestly report ("reliable data unavailable") rather
 * than an exception that gets swallowed and turned into a guess.
 */

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail<T = never>(reason: string): Result<T> {
  return { ok: false, reason };
}

export interface GetJsonOptions {
  /** Seconds of Next.js data-cache reuse. 0 disables caching. */
  revalidate?: number;
  timeoutMs?: number;
  /** Total attempts, including the first. Only 5xx / network errors are retried. */
  attempts?: number;
  headers?: Record<string, string>;
}

export function buildUrl(
  base: string,
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function getJson<T>(
  url: string,
  options: GetJsonOptions = {},
): Promise<Result<T>> {
  const { revalidate = 300, timeoutMs = 9000, attempts = 2, headers } = options;
  let lastReason = "unknown error";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json", ...headers },
        next: revalidate > 0 ? { revalidate } : undefined,
        cache: revalidate > 0 ? undefined : "no-store",
      });

      if (!response.ok) {
        const body = (await response.text().catch(() => "")).slice(0, 300);
        lastReason = `upstream responded ${response.status}${body ? `: ${body}` : ""}`;
        // 4xx is a request problem - retrying will not help.
        if (response.status < 500) return fail(lastReason);
        continue;
      }

      return ok((await response.json()) as T);
    } catch (error) {
      lastReason =
        error instanceof Error
          ? error.name === "TimeoutError" || error.name === "AbortError"
            ? `request timed out after ${timeoutMs}ms`
            : error.message
          : "network error";
    }
  }

  return fail(lastReason);
}
