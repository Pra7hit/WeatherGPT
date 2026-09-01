import { callerKey, checkRateLimit } from "@/lib/guardrails";
import { reverseGeocode } from "@/services/location";

/**
 * Browser coordinates -> place name, so the header can show where "here" is.
 * Rate limited for the same reason as /api/geocode: the upstream is a free
 * public service and this route is the only thing standing in front of it.
 */
export const runtime = "nodejs";

const REVERSE_LIMIT = 30;

export async function GET(request: Request): Promise<Response> {
  const rate = checkRateLimit(`reverse:${callerKey(request)}`, REVERSE_LIMIT);
  if (!rate.ok) {
    return Response.json(
      { error: "too many lookups - please wait a moment" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Response.json({ error: "lat and lon are required" }, { status: 400 });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return Response.json({ error: "lat/lon out of range" }, { status: 400 });
  }

  const result = await reverseGeocode(latitude, longitude);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 502 });
  }

  return Response.json({ place: result.data });
}
