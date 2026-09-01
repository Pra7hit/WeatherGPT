import "server-only";

import { buildUrl, fail, getJson, ok, type Result } from "@/lib/http";
import type { Place } from "@/services/weather/types";

/**
 * Location resolution. Both providers are keyless.
 *
 *  - Forward geocoding: Open-Meteo geocoding API (city name -> coordinates)
 *  - Reverse geocoding: BigDataCloud reverse-geocode-client (coordinates -> place name)
 *
 * Timezone for reverse-geocoded places is left as "auto"; Open-Meteo resolves it
 * from the coordinates and we propagate the real value back from that response.
 */

const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_URL = "https://api.bigdatacloud.net/data/reverse-geocode-client";

/**
 * Open-Meteo's geocoder only matches a name in the script of the requested
 * `language`: `language=en` finds "Delhi" but returns nothing for "दिल्ली", while
 * `language=hi` finds "दिल्ली" and answers in Devanagari. So the script of the
 * query picks the language rather than the caller's UI language.
 */
const DEVANAGARI = /[ऀ-ॿ]/;

interface GeocodeResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  admin1?: string;
  country?: string;
  country_code?: string;
  timezone?: string;
  population?: number;
  feature_code?: string;
}

interface GeocodeResponse {
  results?: GeocodeResult[];
}

interface ReverseResponse {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
}

function toPlace(result: GeocodeResult): Place | null {
  if (
    !result.name ||
    typeof result.latitude !== "number" ||
    typeof result.longitude !== "number"
  ) {
    return null;
  }
  return {
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    admin1: result.admin1,
    country: result.country,
    timezone: result.timezone || "auto",
  };
}

export { describePlace } from "@/lib/format";

/** Look up candidate places for a free-text query. Never guesses coordinates. */
export async function geocode(query: string, limit = 5): Promise<Result<Place[]>> {
  const trimmed = query.trim();
  if (trimmed.length === 0) return fail("empty location query");

  const url = buildUrl(GEOCODE_URL, {
    name: trimmed,
    count: Math.min(Math.max(limit, 1), 10),
    language: DEVANAGARI.test(trimmed) ? "hi" : "en",
    format: "json",
  });

  const response = await getJson<GeocodeResponse>(url, { revalidate: 86_400 });
  if (!response.ok) return fail(`geocoding service unavailable (${response.reason})`);

  const places = (response.data.results ?? [])
    .map(toPlace)
    .filter((place): place is Place => place !== null);

  if (places.length === 0) return fail(`no place found matching "${trimmed}"`);
  return ok(places);
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<Result<Place>> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fail("invalid coordinates");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return fail("coordinates out of range");
  }

  const url = buildUrl(REVERSE_URL, {
    latitude,
    longitude,
    localityLanguage: "en",
  });

  const response = await getJson<ReverseResponse>(url, { revalidate: 86_400 });

  // A reverse-geocode failure is not fatal - we still have usable coordinates.
  if (!response.ok) {
    return ok({
      name: `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
      latitude,
      longitude,
      timezone: "auto",
    });
  }

  const body = response.data;
  const name =
    body.city ||
    body.locality ||
    body.principalSubdivision ||
    `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

  return ok({
    name,
    latitude,
    longitude,
    admin1: body.principalSubdivision,
    country: body.countryName,
    timezone: "auto",
  });
}
