import "server-only";

import { cardId, describePlace, fmtMm, fmtPct, fmtTemp, fmtVisibility, fmtWind } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/http";
import { dayLabel, hourLabel } from "@/lib/time";
import type { WeatherCardData } from "@/lib/types";
import { conditionForModel } from "@/services/weather/codes";
import { fetchForecast } from "@/services/weather/openMeteo";
import { selectHourRows, summariseHours, type PartOfDay } from "@/services/weather";
import type { HourlyForecastRow, Place, WeatherBundle } from "@/services/weather/types";

/**
 * Activity advisory layer.
 *
 * This module does the *arithmetic* (window aggregation, threshold flags) and
 * hands the model decision-relevant facts. The recommendation prose itself is
 * written by the AI, in the user's language - so this file never contains advice
 * text that would need translating, and the model never has to reduce 24 hourly
 * rows in its head.
 */

export type ActivityKind = "umbrella" | "outdoor" | "travel" | "general";

const PART_LABEL: Record<PartOfDay, string> = {
  morning: "morning",
  afternoon: "afternoon",
  evening: "evening",
  night: "night",
};

export interface ActivityFlags {
  rainLikely: boolean;
  heavyRain: boolean;
  thunderstorm: boolean;
  highHeatStress: boolean;
  strongWind: boolean;
  lowVisibility: boolean;
  cold: boolean;
}

export interface ActivityFacts {
  place: string;
  kind: ActivityKind;
  windowLabel: string;
  from: string | null;
  to: string | null;
  hoursConsidered: number;
  minTempC: number | null;
  maxTempC: number | null;
  maxApparentC: number | null;
  maxPrecipProbabilityPct: number | null;
  totalPrecipitationMm: number | null;
  maxGustsKmh: number | null;
  minVisibilityM: number | null;
  dominantCondition: string;
  /** Hours within the window where rain probability is at or above 40%. */
  wettestHours: Array<{ time: string; probabilityPct: number | null; mm: number | null }>;
  flags: ActivityFlags;
}

export interface ActivityAdvisoryResult {
  facts: ActivityFacts;
  card: WeatherCardData;
}

function selectHours(
  bundle: WeatherBundle,
  options: { date?: string; partOfDay?: PartOfDay },
): { rows: HourlyForecastRow[]; label: string } {
  const rows = selectHourRows(bundle, options);
  let label = options.date ? dayLabel(options.date, "en") : "next 24 hours";
  if (options.partOfDay && rows.length > 0) {
    label = `${label}, ${PART_LABEL[options.partOfDay]}`;
  }
  return { rows, label };
}

export async function getActivityAdvisory(
  place: Place,
  kind: ActivityKind,
  options: {
    date?: string;
    partOfDay?: PartOfDay;
    language?: "en" | "hi";
    bundle?: WeatherBundle;
  } = {},
): Promise<Result<ActivityAdvisoryResult>> {
  let bundle = options.bundle;
  if (!bundle) {
    const forecast = await fetchForecast(place, 7);
    if (!forecast.ok) return fail(forecast.reason);
    bundle = forecast.data;
  }

  const { rows, label } = selectHours(bundle, options);
  if (rows.length === 0) {
    return fail(
      options.date
        ? `no hourly forecast rows available for ${options.date}`
        : "no hourly forecast rows available",
    );
  }

  const summary = summariseHours(rows);
  const visibilities = rows
    .map((row) => row.visibilityM)
    .filter((value): value is number => value !== null);
  const minVisibilityM = visibilities.length ? Math.min(...visibilities) : null;
  const storm = rows.some((row) => row.weatherCode !== null && [95, 96, 99].includes(row.weatherCode));

  const facts: ActivityFacts = {
    place: describePlace(bundle.place),
    kind,
    windowLabel: label,
    from: rows[0]?.time ?? null,
    to: rows[rows.length - 1]?.time ?? null,
    hoursConsidered: rows.length,
    minTempC: summary.minTempC,
    maxTempC: summary.maxTempC,
    maxApparentC: summary.maxApparentC,
    maxPrecipProbabilityPct: summary.maxPrecipProbabilityPct,
    totalPrecipitationMm: summary.totalPrecipitationMm,
    maxGustsKmh: summary.maxGustsKmh,
    minVisibilityM,
    dominantCondition: conditionForModel(summary.dominantCode),
    wettestHours: rows
      .filter((row) => (row.precipitationProbabilityPct ?? 0) >= 40)
      .slice(0, 6)
      .map((row) => ({
        time: row.time,
        probabilityPct: row.precipitationProbabilityPct,
        mm: row.precipitationMm,
      })),
    flags: {
      rainLikely: (summary.maxPrecipProbabilityPct ?? 0) >= 40,
      heavyRain: (summary.totalPrecipitationMm ?? 0) >= 15,
      thunderstorm: storm,
      highHeatStress: (summary.maxApparentC ?? -100) >= 37,
      strongWind: (summary.maxGustsKmh ?? 0) >= 45,
      lowVisibility: minVisibilityM !== null && minVisibilityM <= 1000,
      cold: (summary.minTempC ?? 100) <= 10,
    },
  };

  const hi = options.language === "hi";
  const card: WeatherCardData = {
    id: cardId("advisory"),
    kind: "forecast",
    place: facts.place,
    headline: `${facts.windowLabel} · ${fmtTemp(facts.maxTempC)} / ${fmtTemp(facts.minTempC)}`,
    subline: `${hi ? "बारिश की संभावना" : "Rain chance"} ${fmtPct(
      facts.maxPrecipProbabilityPct,
    )} · ${fmtMm(facts.totalPrecipitationMm)}`,
    conditionCode: summary.dominantCode,
    metrics: [
      { label: hi ? "बारिश की संभावना" : "Rain chance", value: fmtPct(facts.maxPrecipProbabilityPct) },
      { label: hi ? "कुल वर्षा" : "Precipitation", value: fmtMm(facts.totalPrecipitationMm) },
      { label: hi ? "महसूस (अधिकतम)" : "Feels like (max)", value: fmtTemp(facts.maxApparentC) },
      { label: hi ? "झोंके" : "Gusts", value: fmtWind(facts.maxGustsKmh) },
      { label: hi ? "दृश्यता (न्यूनतम)" : "Visibility (min)", value: fmtVisibility(facts.minVisibilityM) },
      { label: hi ? "घंटे" : "Hours", value: String(facts.hoursConsidered) },
    ],
    hourly: rows.slice(0, 24).map((row) => ({
      time: row.time,
      label: hourLabel(row.time, options.language ?? "en"),
      tempC: row.temperatureC,
      precipProbability: row.precipitationProbabilityPct,
      conditionCode: row.weatherCode,
    })),
    provenance: {
      dataKind: "forecast",
      source: "Open-Meteo forecast API",
      retrievedAt: bundle.retrievedAt,
      isReal: true,
      note: "Aggregated forecast window. Any recommendation built on it is AI-generated advice, not a safety guarantee.",
    },
  };

  return ok({ facts, card });
}

export { getAgricultureAdvisory } from "./agriculture";
export type { AgricultureFacts } from "./agriculture";
