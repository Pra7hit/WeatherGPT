import "server-only";

import { env } from "@/lib/env";
import { cardId, describePlace } from "@/lib/format";
import { buildUrl, getJson } from "@/lib/http";
import type { AlertCardData, AlertSeverity } from "@/lib/types";
import type { Place } from "@/services/weather/types";

/**
 * Official government warnings, via OpenWeatherMap One Call 3.0 `alerts[]`,
 * which relays warnings issued by national meteorological agencies.
 *
 * This channel is OPTIONAL and key-gated. When no key is configured we return
 * `configured: false` with an empty list - we never synthesise an official
 * warning, and the AI layer is instructed to say the channel is unavailable
 * rather than imply that no warnings exist.
 *
 * One Call 3.0 also needs its own "One Call by Call" subscription on the
 * OpenWeatherMap account: a valid key without it answers 401. That surfaces here as
 * `configured: true` with `error` set - a third state, and the one most likely to be
 * mishandled, because "the lookup failed" must never be reported as "no warning is
 * active". Both `execute.ts` and `fallback.ts` branch on `error` for exactly that.
 */

const URL = "https://api.openweathermap.org/data/3.0/onecall";

interface OwmAlert {
  sender_name?: string;
  event?: string;
  start?: number;
  end?: number;
  description?: string;
  tags?: string[];
}

interface OwmResponse {
  alerts?: OwmAlert[];
}

export interface OfficialAlertsResult {
  configured: boolean;
  provider: string | null;
  alerts: AlertCardData[];
  /** Set when the provider is configured but the lookup failed. */
  error?: string;
}

/** Keyword-based ordering hint only. The authority's own text is what we display. */
function severityFor(event: string): AlertSeverity {
  const text = event.toLowerCase();
  if (/(cyclone|hurricane|tornado|extreme|tsunami)/.test(text)) return "extreme";
  if (/(severe|heavy|storm|flood|heat ?wave|gale|warning)/.test(text)) return "severe";
  if (/(moderate|watch|advisory|alert)/.test(text)) return "moderate";
  return "minor";
}

function toIso(unixSeconds: number | undefined): string | undefined {
  if (typeof unixSeconds !== "number" || !Number.isFinite(unixSeconds)) return undefined;
  return new Date(unixSeconds * 1000).toISOString();
}

export async function getOfficialAlerts(place: Place): Promise<OfficialAlertsResult> {
  if (!env.openWeatherApiKey) {
    return { configured: false, provider: null, alerts: [] };
  }

  const url = buildUrl(URL, {
    lat: place.latitude,
    lon: place.longitude,
    appid: env.openWeatherApiKey,
    exclude: "current,minutely,hourly,daily",
  });

  const response = await getJson<OwmResponse>(url, { revalidate: 300 });
  if (!response.ok) {
    return {
      configured: true,
      provider: "OpenWeatherMap One Call 3.0",
      alerts: [],
      // Never leak the key if it appears in an upstream error string, and keep the
      // reason short enough to quote in an answer.
      error: response.reason.replaceAll(env.openWeatherApiKey, "***").slice(0, 180).trim(),
    };
  }

  const retrievedAt = new Date().toISOString();
  const placeLabel = describePlace(place);

  const alerts: AlertCardData[] = (response.data.alerts ?? [])
    .filter((alert) => alert.event || alert.description)
    .map((alert) => {
      const event = alert.event?.trim() || "Weather warning";
      const authority = alert.sender_name?.trim() || "Issuing meteorological authority";
      return {
        id: cardId("official"),
        official: true,
        severity: severityFor(event),
        event,
        place: placeLabel,
        authority,
        starts: toIso(alert.start),
        ends: toIso(alert.end),
        description: (alert.description ?? "").trim().slice(0, 2000),
        provenance: {
          dataKind: "official_warning" as const,
          source: `${authority} (relayed by OpenWeatherMap One Call 3.0)`,
          retrievedAt,
          isReal: true,
          note: alert.tags?.length ? `Tags: ${alert.tags.join(", ")}` : undefined,
        },
      };
    });

  return { configured: true, provider: "OpenWeatherMap One Call 3.0", alerts };
}
