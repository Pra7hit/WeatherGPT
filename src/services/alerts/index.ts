import "server-only";

import { fail, ok, type Result } from "@/lib/http";
import type { AlertCardData } from "@/lib/types";
import { fetchForecast } from "@/services/weather/openMeteo";
import type { Place, WeatherBundle } from "@/services/weather/types";
import { deriveAdvisories } from "./derived";
import { getOfficialAlerts, type OfficialAlertsResult } from "./official";

export interface AlertsResult {
  official: OfficialAlertsResult;
  /** Threshold-based advisories. Never official. */
  derived: AlertCardData[];
  place: Place;
}

const SEVERITY_ORDER = ["extreme", "severe", "moderate", "minor", "info"] as const;

function bySeverity(a: AlertCardData, b: AlertCardData): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
}

/**
 * Both channels for one place. `official` and `derived` stay separate all the way
 * to the UI so the two can never be presented as the same thing.
 */
export async function getAlerts(
  place: Place,
  options: { language?: "en" | "hi"; bundle?: WeatherBundle } = {},
): Promise<Result<AlertsResult>> {
  let bundle = options.bundle;

  if (!bundle) {
    const forecast = await fetchForecast(place, 5);
    if (!forecast.ok) return fail(forecast.reason);
    bundle = forecast.data;
  }

  const official = await getOfficialAlerts(bundle.place);
  const derived = deriveAdvisories(bundle, options.language ?? "en").sort(bySeverity);

  return ok({
    official: { ...official, alerts: official.alerts.slice().sort(bySeverity) },
    derived,
    place: bundle.place,
  });
}

export { deriveAdvisories } from "./derived";
export { getOfficialAlerts } from "./official";
export type { OfficialAlertsResult } from "./official";
