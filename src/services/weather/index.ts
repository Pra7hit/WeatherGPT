import "server-only";

import {
  cardId,
  describePlace,
  fmtMm,
  fmtPct,
  fmtPressure,
  fmtTemp,
  fmtUv,
  fmtVisibility,
  fmtWind,
  windDirection,
} from "@/lib/format";
import { fail, ok, type Result } from "@/lib/http";
import { dayLabel, hourLabel } from "@/lib/time";
import type { WeatherCardData } from "@/lib/types";
import { conditionText } from "./codes";
import { fetchForecast } from "./openMeteo";
import type {
  DailyForecastRow,
  HourlyForecastRow,
  Place,
  WeatherBundle,
} from "./types";

export type Lang = "en" | "hi";
export type PartOfDay = "morning" | "afternoon" | "evening" | "night";

/** Hour windows used when a question narrows to a part of the day. */
const WINDOWS: Record<PartOfDay, number[]> = {
  morning: [6, 7, 8, 9, 10, 11],
  afternoon: [12, 13, 14, 15, 16],
  evening: [17, 18, 19, 20],
  night: [21, 22, 23, 0, 1, 2, 3, 4, 5],
};

const SOURCE = "Open-Meteo forecast API (ICON / GFS / ECMWF blend)";

export interface WeatherResult {
  bundle: WeatherBundle;
  card: WeatherCardData;
}

function hourOf(time: string): number {
  return Number(time.slice(11, 13));
}

export function summariseHours(rows: HourlyForecastRow[]) {
  const temps = rows.map((r) => r.temperatureC).filter((v): v is number => v !== null);
  const apparent = rows
    .map((r) => r.apparentTemperatureC)
    .filter((v): v is number => v !== null);
  const probs = rows
    .map((r) => r.precipitationProbabilityPct)
    .filter((v): v is number => v !== null);
  const precip = rows.map((r) => r.precipitationMm).filter((v): v is number => v !== null);
  const gusts = rows.map((r) => r.windGustsKmh).filter((v): v is number => v !== null);

  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.weatherCode === null) continue;
    counts.set(row.weatherCode, (counts.get(row.weatherCode) ?? 0) + 1);
  }
  let dominantCode: number | null = null;
  let best = -1;
  for (const [code, count] of counts) {
    // Ties break toward the more severe (higher) WMO code.
    if (count > best || (count === best && dominantCode !== null && code > dominantCode)) {
      best = count;
      dominantCode = code;
    }
  }

  return {
    minTempC: temps.length ? Math.min(...temps) : null,
    maxTempC: temps.length ? Math.max(...temps) : null,
    maxApparentC: apparent.length ? Math.max(...apparent) : null,
    maxPrecipProbabilityPct: probs.length ? Math.max(...probs) : null,
    totalPrecipitationMm: precip.length
      ? Math.round(precip.reduce((a, b) => a + b, 0) * 10) / 10
      : null,
    maxGustsKmh: gusts.length ? Math.max(...gusts) : null,
    dominantCode,
  };
}

function toHourlyPoints(rows: HourlyForecastRow[], language: Lang) {
  return rows.map((row) => ({
    time: row.time,
    label: hourLabel(row.time, language),
    tempC: row.temperatureC,
    precipProbability: row.precipitationProbabilityPct,
    conditionCode: row.weatherCode,
  }));
}

function toDailyPoints(rows: DailyForecastRow[], language: Lang) {
  return rows.map((row) => ({
    date: row.date,
    label: dayLabel(row.date, language),
    maxC: row.tempMaxC,
    minC: row.tempMinC,
    precipProbability: row.precipitationProbabilityMaxPct,
    precipMm: row.precipitationSumMm,
    conditionCode: row.weatherCode,
  }));
}

/** Hourly rows from `now` forward, capped. Keeps tool results small. */
export function upcomingHours(bundle: WeatherBundle, limit = 24): HourlyForecastRow[] {
  const anchor = bundle.current?.time?.slice(0, 13);
  const startIndex = anchor
    ? Math.max(bundle.hourly.findIndex((row) => row.time.slice(0, 13) >= anchor), 0)
    : 0;
  return bundle.hourly.slice(startIndex, startIndex + limit);
}

/**
 * The hourly rows a question is actually about: a named day, optionally narrowed
 * to a part of the day, else the hours ahead of now. Shared by the forecast card,
 * the advisory layer and the tool executor so all three agree on what "evening"
 * means. A part-of-day filter that would empty the set is ignored.
 */
export function selectHourRows(
  bundle: WeatherBundle,
  options: { date?: string; partOfDay?: PartOfDay; limit?: number } = {},
): HourlyForecastRow[] {
  let rows = options.date
    ? bundle.hourly.filter((row) => row.time.slice(0, 10) === options.date)
    : upcomingHours(bundle, options.limit ?? 24);

  if (options.partOfDay) {
    const allowed = new Set(WINDOWS[options.partOfDay]);
    const narrowed = rows.filter((row) => allowed.has(hourOf(row.time)));
    if (narrowed.length > 0) rows = narrowed;
  }

  return options.limit ? rows.slice(0, options.limit) : rows;
}

function buildCurrentCard(bundle: WeatherBundle, language: Lang): WeatherCardData {
  const current = bundle.current;
  const condition = conditionText(current?.weatherCode, language);
  const place = describePlace(bundle.place);

  return {
    id: cardId("current"),
    kind: "current",
    place,
    headline: `${fmtTemp(current?.temperatureC)} · ${condition}`,
    subline: `${language === "hi" ? "महसूस होता है" : "Feels like"} ${fmtTemp(
      current?.apparentTemperatureC,
    )}`,
    conditionCode: current?.weatherCode ?? null,
    metrics: [
      { label: language === "hi" ? "महसूस" : "Feels like", value: fmtTemp(current?.apparentTemperatureC) },
      { label: language === "hi" ? "नमी" : "Humidity", value: fmtPct(current?.humidityPct) },
      {
        label: language === "hi" ? "हवा" : "Wind",
        value: fmtWind(current?.windSpeedKmh),
        hint: windDirection(current?.windDirectionDeg),
      },
      { label: language === "hi" ? "झोंके" : "Gusts", value: fmtWind(current?.windGustsKmh) },
      {
        label: language === "hi" ? "बारिश की संभावना" : "Rain chance",
        value: fmtPct(current?.precipitationProbabilityPct),
      },
      { label: language === "hi" ? "वर्षा" : "Precipitation", value: fmtMm(current?.precipitationMm) },
      { label: language === "hi" ? "दृश्यता" : "Visibility", value: fmtVisibility(current?.visibilityM) },
      { label: language === "hi" ? "दबाव" : "Pressure", value: fmtPressure(current?.pressureHpa) },
    ],
    hourly: toHourlyPoints(upcomingHours(bundle, 12), language),
    provenance: {
      dataKind: "observation",
      source: SOURCE,
      retrievedAt: bundle.retrievedAt,
      isReal: true,
      note: current?.time ? `Observation time ${current.time} (${bundle.place.timezone})` : undefined,
    },
  };
}

export interface ForecastOptions {
  days?: number;
  /** YYYY-MM-DD. When present the card focuses on this day. */
  date?: string;
  partOfDay?: PartOfDay;
  language?: Lang;
}

function buildForecastCard(
  bundle: WeatherBundle,
  options: ForecastOptions,
): WeatherCardData {
  const language = options.language ?? "en";
  const place = describePlace(bundle.place);
  const hi = language === "hi";

  const focusDay = options.date
    ? bundle.daily.find((row) => row.date === options.date)
    : undefined;

  const focusHours = selectHourRows(bundle, {
    date: options.date,
    partOfDay: options.partOfDay,
  });

  const summary = summariseHours(focusHours);
  const code = focusDay?.weatherCode ?? summary.dominantCode;
  const condition = conditionText(code, language);

  const dayName = options.date ? dayLabel(options.date, language) : hi ? "आगे" : "Next 24 h";
  const partLabel = options.partOfDay
    ? ` · ${
        hi
          ? { morning: "सुबह", afternoon: "दोपहर", evening: "शाम", night: "रात" }[options.partOfDay]
          : options.partOfDay
      }`
    : "";

  const high = focusDay?.tempMaxC ?? summary.maxTempC;
  const low = focusDay?.tempMinC ?? summary.minTempC;

  return {
    id: cardId("forecast"),
    kind: "forecast",
    place,
    headline: `${dayName}${partLabel}: ${fmtTemp(high)} / ${fmtTemp(low)} · ${condition}`,
    subline: `${hi ? "बारिश की संभावना" : "Rain chance"} ${fmtPct(
      focusDay?.precipitationProbabilityMaxPct ?? summary.maxPrecipProbabilityPct,
    )}`,
    conditionCode: code,
    metrics: [
      { label: hi ? "अधिकतम" : "High", value: fmtTemp(high) },
      { label: hi ? "न्यूनतम" : "Low", value: fmtTemp(low) },
      {
        label: hi ? "महसूस (अधिकतम)" : "Feels like (max)",
        value: fmtTemp(focusDay?.apparentMaxC ?? summary.maxApparentC),
      },
      {
        label: hi ? "बारिश की संभावना" : "Rain chance",
        value: fmtPct(focusDay?.precipitationProbabilityMaxPct ?? summary.maxPrecipProbabilityPct),
      },
      {
        label: hi ? "कुल वर्षा" : "Precipitation",
        value: fmtMm(focusDay?.precipitationSumMm ?? summary.totalPrecipitationMm),
      },
      { label: hi ? "हवा (अधिकतम)" : "Wind (max)", value: fmtWind(focusDay?.windSpeedMaxKmh) },
      {
        label: hi ? "झोंके (अधिकतम)" : "Gusts (max)",
        value: fmtWind(focusDay?.windGustsMaxKmh ?? summary.maxGustsKmh),
      },
      { label: hi ? "यूवी सूचकांक" : "UV index", value: fmtUv(focusDay?.uvIndexMax) },
    ],
    hourly: toHourlyPoints(focusHours.slice(0, 24), language),
    daily: toDailyPoints(bundle.daily.slice(0, options.days ?? 7), language),
    provenance: {
      dataKind: "forecast",
      source: SOURCE,
      retrievedAt: bundle.retrievedAt,
      isReal: true,
      note: `Model forecast, not an observation. Timezone ${bundle.place.timezone}.`,
    },
  };
}

export async function getCurrentWeather(
  place: Place,
  language: Lang = "en",
): Promise<Result<WeatherResult>> {
  const forecast = await fetchForecast(place, 3);
  if (!forecast.ok) return fail(forecast.reason);
  if (!forecast.data.current) {
    return fail("provider returned no current observation for this location");
  }
  return ok({ bundle: forecast.data, card: buildCurrentCard(forecast.data, language) });
}

export async function getForecast(
  place: Place,
  options: ForecastOptions = {},
): Promise<Result<WeatherResult>> {
  const days = Math.min(Math.max(options.days ?? 7, 1), 16);
  const forecast = await fetchForecast(place, days);
  if (!forecast.ok) return fail(forecast.reason);

  if (options.date && !forecast.data.daily.some((row) => row.date === options.date)) {
    const available = forecast.data.daily.map((row) => row.date);
    return fail(
      `no forecast available for ${options.date}; provider covers ${available[0] ?? "?"}..${
        available[available.length - 1] ?? "?"
      }`,
    );
  }

  return ok({
    bundle: forecast.data,
    card: buildForecastCard(forecast.data, { ...options, days }),
  });
}

export { fetchAgronomy, fetchArchive, fetchForecast, fetchGfs } from "./openMeteo";
export { condition, conditionForModel, conditionText } from "./codes";
