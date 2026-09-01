import "server-only";

import { round } from "@/lib/format";
import type { AlertCardData, ClientLocation, Provenance, WeatherCardData } from "@/lib/types";
import { getActivityAdvisory, getAgricultureAdvisory, type ActivityKind } from "@/services/advisory";
import { getAlerts } from "@/services/alerts";
import { getClimateTrend, getHistoricalSummary } from "@/services/historical";
import { geocode, reverseGeocode } from "@/services/location";
import { getNwpForecast, isNwpModelId } from "@/services/nwp";
import {
  conditionForModel,
  getCurrentWeather,
  getForecast,
  selectHourRows,
  type Lang,
} from "@/services/weather";
import type { HourlyForecastRow, Place, WeatherBundle } from "@/services/weather/types";

/**
 * Tool dispatch.
 *
 * Each branch calls a service, shapes a *compact* payload for the model (full
 * hourly arrays would be thousands of tokens of noise), attaches provenance, and
 * hands back any card/alert the UI should render. A service failure becomes an
 * error tool result - the model is instructed to report those as "data
 * unavailable", never to fill the gap.
 */

export interface ExecContext {
  /** Card label language, from the client's selector; a tool call may override it. */
  language: Lang;
  clientLocation?: ClientLocation | null;
  /** Per-request forecast cache, so alerts/advisory reuse an already-fetched bundle. */
  bundles: Map<string, WeatherBundle>;
}

export function createExecContext(
  language: Lang,
  clientLocation?: ClientLocation | null,
): ExecContext {
  return { language, clientLocation, bundles: new Map() };
}

export interface ToolOutcome {
  /** Short human-readable trace shown in the UI, e.g. "Forecast · Delhi". */
  label: string;
  /** JSON string placed in the tool_result block. */
  content: string;
  isError?: boolean;
  cards: WeatherCardData[];
  alerts: AlertCardData[];
}

type Input = Record<string, unknown>;

function asInput(value: unknown): Input {
  return value !== null && typeof value === "object" ? (value as Input) : {};
}

function str(input: Input, key: string): string | undefined {
  const value = input[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function numOf(input: Input, key: string): number | undefined {
  const value = input[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
}

function enumOf<T extends string>(input: Input, key: string, allowed: readonly T[]): T | undefined {
  const value = str(input, key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

function langOf(input: Input, ctx: ExecContext): Lang {
  return enumOf(input, "language", ["en", "hi"] as const) ?? ctx.language;
}

function errorOutcome(label: string, reason: string): ToolOutcome {
  return {
    label,
    content: JSON.stringify({ ok: false, error: reason }),
    isError: true,
    cards: [],
    alerts: [],
  };
}

function payload(data: unknown, meta: Provenance): string {
  return JSON.stringify({ ok: true, data, _meta: meta });
}

function cacheKey(place: Place): string {
  return `${round(place.latitude, 2)},${round(place.longitude, 2)}`;
}

/**
 * Turn whatever the model supplied into a real Place. Coordinates win over a
 * name; a bare name is geocoded; with neither, the browser-supplied location is
 * used. If none of those exist the tool fails and the model must ask.
 */
async function resolvePlace(
  input: Input,
  ctx: ExecContext,
): Promise<{ ok: true; place: Place } | { ok: false; reason: string }> {
  const latitude = numOf(input, "latitude");
  const longitude = numOf(input, "longitude");
  const name = str(input, "place");

  if (latitude !== undefined && longitude !== undefined) {
    const reverse = await reverseGeocode(latitude, longitude);
    if (!reverse.ok) return { ok: false, reason: reverse.reason };
    return { ok: true, place: name ? { ...reverse.data, name } : reverse.data };
  }

  if (name) {
    const found = await geocode(name, 3);
    if (!found.ok) {
      return {
        ok: false,
        reason: `${found.reason}. Do not guess coordinates or weather for this name - tell the user the place could not be found and ask them to check the spelling or give a nearby larger city.`,
      };
    }
    return { ok: true, place: found.data[0] };
  }

  const client = ctx.clientLocation;
  if (client) {
    const reverse = await reverseGeocode(client.latitude, client.longitude);
    if (!reverse.ok) return { ok: false, reason: reverse.reason };
    return {
      ok: true,
      place: client.name ? { ...reverse.data, name: client.name } : reverse.data,
    };
  }

  return {
    ok: false,
    reason:
      "no location was provided and no client location is available - ask the user which city they mean.",
  };
}

function cachedBundle(ctx: ExecContext, place: Place, minDailyRows: number): WeatherBundle | undefined {
  const bundle = ctx.bundles.get(cacheKey(place));
  return bundle && bundle.daily.length >= minDailyRows ? bundle : undefined;
}

function hourDigest(rows: HourlyForecastRow[], limit: number) {
  return rows.slice(0, limit).map((row) => ({
    time: row.time,
    tempC: row.temperatureC,
    feelsLikeC: row.apparentTemperatureC,
    humidityPct: row.humidityPct,
    rainProbabilityPct: row.precipitationProbabilityPct,
    precipitationMm: row.precipitationMm,
    windGustsKmh: row.windGustsKmh,
    visibilityM: row.visibilityM,
    condition: conditionForModel(row.weatherCode),
  }));
}

function dailyDigest(bundle: WeatherBundle, days: number) {
  return bundle.daily.slice(0, days).map((row) => ({
    date: row.date,
    condition: conditionForModel(row.weatherCode),
    tempMaxC: row.tempMaxC,
    tempMinC: row.tempMinC,
    feelsLikeMaxC: row.apparentMaxC,
    feelsLikeMinC: row.apparentMinC,
    rainProbabilityMaxPct: row.precipitationProbabilityMaxPct,
    precipitationSumMm: row.precipitationSumMm,
    windMaxKmh: row.windSpeedMaxKmh,
    windGustsMaxKmh: row.windGustsMaxKmh,
    uvIndexMax: row.uvIndexMax,
    sunrise: row.sunrise,
    sunset: row.sunset,
  }));
}

function placeInfo(place: Place) {
  return {
    name: place.name,
    admin1: place.admin1 ?? null,
    country: place.country ?? null,
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: place.timezone,
  };
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined) return fallback;
  return Math.min(Math.max(Math.round(value), min), max);
}

const PARTS = ["morning", "afternoon", "evening", "night"] as const;

export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ExecContext,
): Promise<ToolOutcome> {
  const input = asInput(rawInput);
  const language = langOf(input, ctx);

  if (name === "resolve_location") {
    const query = str(input, "query");
    if (!query) return errorOutcome("Location lookup", "missing `query`");
    const limit = clampInt(numOf(input, "limit"), 1, 10, 5);
    const found = await geocode(query, limit);
    if (!found.ok) {
      return errorOutcome(
        `Location lookup · ${query}`,
        `${found.reason}. Tell the user the place could not be found; do not invent coordinates or weather for it.`,
      );
    }
    return {
      label: `Location lookup · ${query}`,
      content: payload(
        { query, candidates: found.data.map(placeInfo) },
        {
          dataKind: "location",
          source: "Open-Meteo geocoding API",
          retrievedAt: new Date().toISOString(),
          isReal: true,
        },
      ),
      cards: [],
      alerts: [],
    };
  }

  const resolved = await resolvePlace(input, ctx);
  if (!resolved.ok) return errorOutcome(toolLabel(name, null), resolved.reason);
  const place = resolved.place;
  const label = toolLabel(name, place.name);

  switch (name) {
    case "get_current_weather": {
      const result = await getCurrentWeather(place, language);
      if (!result.ok) return errorOutcome(label, result.reason);
      const bundle = result.data.bundle;
      ctx.bundles.set(cacheKey(bundle.place), bundle);

      return {
        label,
        content: payload(
          {
            place: placeInfo(bundle.place),
            units: bundle.units,
            observedAt: bundle.current?.time ?? null,
            current: {
              ...bundle.current,
              condition: conditionForModel(bundle.current?.weatherCode ?? null),
            },
            next12Hours: hourDigest(selectHourRows(bundle, { limit: 12 }), 12),
          },
          result.data.card.provenance,
        ),
        cards: [result.data.card],
        alerts: [],
      };
    }

    case "get_forecast": {
      const date = str(input, "date");
      const partOfDay = enumOf(input, "part_of_day", PARTS);
      const days = clampInt(numOf(input, "days"), 1, 16, 7);

      const result = await getForecast(place, { date, partOfDay, days, language });
      if (!result.ok) return errorOutcome(label, result.reason);
      const bundle = result.data.bundle;
      ctx.bundles.set(cacheKey(bundle.place), bundle);

      const focusHours = selectHourRows(bundle, { date, partOfDay });
      const focusDay = date ? bundle.daily.find((row) => row.date === date) : undefined;

      return {
        label: label + (date ? ` · ${date}` : "") + (partOfDay ? ` ${partOfDay}` : ""),
        content: payload(
          {
            place: placeInfo(bundle.place),
            units: bundle.units,
            requested: { date: date ?? null, partOfDay: partOfDay ?? null, days },
            focusDay: focusDay
              ? { ...focusDay, condition: conditionForModel(focusDay.weatherCode) }
              : null,
            focusHours: hourDigest(focusHours, 24),
            daily: dailyDigest(bundle, days),
          },
          result.data.card.provenance,
        ),
        cards: [result.data.card],
        alerts: [],
      };
    }

    case "get_weather_alerts": {
      const result = await getAlerts(place, {
        language,
        bundle: cachedBundle(ctx, place, 5),
      });
      if (!result.ok) return errorOutcome(label, result.reason);
      const { official, derived } = result.data;

      /**
       * Three states, not two. A configured provider that failed its lookup is not
       * the same as one that answered "nothing active" — claiming the second when
       * the truth is the first would be inventing the absence of a warning.
       */
      const officialGuidance = !official.configured
        ? "The official-warning provider is NOT configured in this deployment, so no official warning can be confirmed or ruled out. Say that explicitly, then offer the forecast-based advisories below."
        : official.error
          ? `The official-warning provider IS configured but this lookup FAILED (${official.error}). You therefore do not know whether an official warning exists: say the official channel could not be reached and why, do NOT say that no warning is active, and point the user at the issuing authority (IMD at imd.gov.in for India). Then offer the forecast-based advisories below.`
          : official.alerts.length > 0
            ? "These are official warnings, fetched successfully. Name the issuing authority."
            : "The official feed answered successfully and returned zero warnings for this place, so you may say no official warning is currently active for it.";

      return {
        label,
        content: payload(
          {
            place: placeInfo(result.data.place),
            official: {
              configured: official.configured,
              provider: official.provider,
              lookupFailed: Boolean(official.error),
              error: official.error ?? null,
              count: official.alerts.length,
              alerts: official.alerts.map((alert) => ({
                event: alert.event,
                authority: alert.authority ?? null,
                severity: alert.severity,
                starts: alert.starts ?? null,
                ends: alert.ends ?? null,
                description: alert.description,
              })),
              guidance: officialGuidance,
            },
            derived: derived.map((alert) => ({
              event: alert.event,
              severity: alert.severity,
              description: alert.description,
              evidence: alert.evidence ?? [],
            })),
            derivedGuidance:
              "Forecast-derived advisories computed from thresholds. These are NOT official warnings and must not be described as issued by IMD or any authority.",
          },
          {
            dataKind: official.alerts.length > 0 ? "official_warning" : "derived_advisory",
            source: official.configured
              ? `${official.provider} (official${official.error ? ", lookup failed" : ""}) + Open-Meteo thresholds (derived)`
              : "Open-Meteo forecast thresholds (derived only; no official provider configured)",
            retrievedAt: new Date().toISOString(),
            isReal: true,
          },
        ),
        cards: [],
        alerts: [...official.alerts, ...derived],
      };
    }

    case "get_historical_weather": {
      const startDate = str(input, "start_date");
      const endDate = str(input, "end_date");
      if (!startDate || !endDate) {
        return errorOutcome(label, "missing `start_date` or `end_date` (YYYY-MM-DD)");
      }

      const result = await getHistoricalSummary(place, startDate, endDate, language);
      if (!result.ok) return errorOutcome(label, result.reason);
      const { summary, card, clampNote } = result.data;

      return {
        label: `${label} · ${summary.startDate}..${summary.endDate}`,
        content: payload(
          {
            place: placeInfo(summary.place),
            requested: { startDate, endDate },
            used: { startDate: summary.startDate, endDate: summary.endDate },
            clampNote: clampNote ?? null,
            days: summary.days,
            meanTempC: summary.meanTempC,
            meanTempMaxC: summary.meanTempMaxC,
            meanTempMinC: summary.meanTempMinC,
            highestTempC: summary.highestTempC,
            lowestTempC: summary.lowestTempC,
            totalPrecipitationMm: summary.totalPrecipitationMm,
            sampleDays: summary.sample,
          },
          card.provenance,
        ),
        cards: [card],
        alerts: [],
      };
    }

    case "get_climate_trend": {
      const startYear = numOf(input, "start_year");
      const endYear = numOf(input, "end_year");
      if (startYear === undefined || endYear === undefined) {
        return errorOutcome(label, "missing `start_year` or `end_year`");
      }
      const month = numOf(input, "month");

      const result = await getClimateTrend(place, Math.round(startYear), Math.round(endYear), {
        month: month === undefined ? undefined : Math.round(month),
        language,
      });
      if (!result.ok) return errorOutcome(label, result.reason);
      const trend = result.data;

      return {
        label: `${label} · ${trend.startYear}–${trend.endYear}`,
        content: payload(
          {
            place: placeInfo(trend.place),
            startYear: trend.startYear,
            endYear: trend.endYear,
            month: trend.month,
            perYear: trend.perYear,
            trendCPerYear: trend.trendCPerYear,
            trendNote:
              trend.trendCPerYear === null
                ? "Fewer than 3 usable years, so no trend was computed. Do not state a trend."
                : "Least-squares slope of annual mean temperature over the years listed.",
          },
          trend.card.provenance,
        ),
        cards: [trend.card],
        alerts: [],
      };
    }

    case "get_nwp_forecast": {
      const modelId = str(input, "model")?.toLowerCase() ?? "";
      if (!isNwpModelId(modelId)) {
        return errorOutcome(label, `unknown model "${modelId}"; valid ids are gfs, icon, ecmwf, wrf`);
      }
      const forecastDays = clampInt(numOf(input, "forecast_days"), 1, 16, 5);

      const result = await getNwpForecast(place, modelId, { forecastDays, language });
      if (!result.ok) return errorOutcome(`${label} · ${modelId.toUpperCase()}`, result.reason);
      const { forecast, card } = result.data;

      return {
        label: `${label} · ${forecast.model.name}`,
        content: payload(
          {
            place: placeInfo(forecast.place),
            model: forecast.model,
            seriesStart: forecast.seriesStart,
            seriesEnd: forecast.seriesEnd,
            modelRunInitTime: forecast.modelRunInitTime,
            modelRunNote:
              "The upstream endpoint does not expose the model run initialisation time, so it is null. Do not state a run time.",
            hours: forecast.rows.length,
            // Every third hour keeps the series readable without dropping the shape.
            series: forecast.rows.filter((_, index) => index % 3 === 0).slice(0, 32),
          },
          card.provenance,
        ),
        cards: [card],
        alerts: [],
      };
    }

    case "get_activity_advisory": {
      const activity = enumOf(input, "activity", [
        "umbrella",
        "outdoor",
        "travel",
        "general",
      ] as const) as ActivityKind | undefined;
      if (!activity) {
        return errorOutcome(label, "missing `activity` (umbrella, outdoor, travel or general)");
      }
      const date = str(input, "date");
      const partOfDay = enumOf(input, "part_of_day", PARTS);

      const result = await getActivityAdvisory(place, activity, {
        date,
        partOfDay,
        language,
        bundle: cachedBundle(ctx, place, 1),
      });
      if (!result.ok) return errorOutcome(label, result.reason);
      const { facts, card } = result.data;

      return {
        label: `${label} · ${activity}`,
        content: payload(
          {
            ...facts,
            guidance:
              "These are aggregates over the window, not a recommendation. Write the advice yourself, in the user's language, and make clear it is a suggestion based on the forecast - not a safety guarantee. For life-threatening conditions refer the user to IMD / NDMA.",
          },
          card.provenance,
        ),
        cards: [card],
        alerts: [],
      };
    }

    case "get_agriculture_advisory": {
      const result = await getAgricultureAdvisory(place, { language });
      if (!result.ok) return errorOutcome(label, result.reason);
      const { facts, card } = result.data;

      return {
        label,
        content: payload(
          {
            ...facts,
            guidance:
              "Real agronomic variables. Base any irrigation suggestion on the water balance and forecast rain, repeat the relevant caveats, and do not claim crop-specific water requirements, sowing windows or pest/disease risk - none of that is in this data.",
          },
          card.provenance,
        ),
        cards: [card],
        alerts: [],
      };
    }

    default:
      return errorOutcome("Unknown tool", `no such tool "${name}"`);
  }
}

const LABELS: Record<string, string> = {
  get_current_weather: "Current weather",
  get_forecast: "Forecast",
  get_weather_alerts: "Alerts check",
  get_historical_weather: "Historical (ERA5)",
  get_climate_trend: "Climate trend (ERA5)",
  get_nwp_forecast: "NWP model",
  get_activity_advisory: "Advisory",
  get_agriculture_advisory: "Agriculture advisory",
  resolve_location: "Location lookup",
};

function toolLabel(name: string, placeName: string | null): string {
  const base = LABELS[name] ?? name;
  return placeName ? `${base} · ${placeName}` : base;
}
