import { callerKey, checkRateLimit, sanitizeText } from "@/lib/guardrails";
import { geocode } from "@/services/location";

/**
 * City search for the location picker. Keyless upstream, so no auth needed here -
 * but it is still rate limited, because a stuck client typing in the search box
 * should not be able to hammer a free public API on our behalf.
 */
export const runtime = "nodejs";

/** Typing produces several searches per minute; the cap only stops a runaway. */
const SEARCH_LIMIT = 60;

export async function GET(request: Request): Promise<Response> {
  const rate = checkRateLimit(`geocode:${callerKey(request)}`, SEARCH_LIMIT);
  if (!rate.ok) {
    return Response.json(
      { places: [], error: "too many searches - please wait a moment" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const query = sanitizeText(raw).slice(0, 120);
  if (query.length < 2) {
    return Response.json({ places: [] });
  }

  const result = await geocode(query, 6);
  if (!result.ok) {
    return Response.json({ places: [], error: result.reason }, { status: 200 });
  }

  return Response.json({ places: result.data });
}
