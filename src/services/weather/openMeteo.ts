import "server-only";

import { buildUrl, fail, getJson, ok, type Result } from "@/lib/http";
import type {
  AgronomyBundle,
  DailyForecastRow,
  HistoricalDailyRow,
  HourlyForecastRow,
  Place,
  WeatherBundle,
} from "./types";

/**
 * Open-Meteo adapter. Keyless, so the app has real data with zero setup.
 *
 * Endpoints used:
 *  - /v1/forecast  current + hourly + daily (ICON/GFS/ECMWF blend)
 *  - /v1/gfs       real GFS model output, for the NWP layer
 *  - archive-api   ERA5 reanalysis, for historical/climate questions
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GFS_URL = "https://api.open-meteo.com/v1/gfs";
const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const CURRENT_VARS = [
  "temperature_2m",
  "relative_humidity_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "rain",
  "precipitation_probability",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "visibility",
].join(",");

const HOURLY_VARS = [
  "temperature_2m",
  "apparent_temperature",
  "relative_humidity_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "wind_gusts_10m",
  "visibility",
].join(",");

const DAILY_VARS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "uv_index_max",
  "sunrise",
  "sunset",
].join(",");

type Series = Record<string, unknown> | undefined;

interface OpenMeteoResponse {
  latitude?: number;
  longitude?: number;
  timezone?: string;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function col(series: Series, key: string): unknown[] {
  const value = series?.[key];
  return Array.isArray(value) ? value : [];
}

function times(series: Series): string[] {
  return col(series, "time").filter((t): t is string => typeof t === "string");
}

function buildHourly(hourly: Series): HourlyForecastRow[] {
  return times(hourly).map((time, i) => ({
    time,
    temperatureC: num(col(hourly, "temperature_2m")[i]),
    apparentTemperatureC: num(col(hourly, "apparent_temperature")[i]),
    humidityPct: num(col(hourly, "relative_humidity_2m")[i]),
    precipitationProbabilityPct: num(col(hourly, "precipitation_probability")[i]),
    precipitationMm: num(col(hourly, "precipitation")[i]),
    weatherCode: num(col(hourly, "weather_code")[i]),
    windSpeedKmh: num(col(hourly, "wind_speed_10m")[i]),
    windGustsKmh: num(col(hourly, "wind_gusts_10m")[i]),
    visibilityM: num(col(hourly, "visibility")[i]),
  }));
}

function buildDaily(daily: Series): DailyForecastRow[] {
  return times(daily).map((date, i) => ({
    date,
    weatherCode: num(col(daily, "weather_code")[i]),
    tempMaxC: num(col(daily, "temperature_2m_max")[i]),
    tempMinC: num(col(daily, "temperature_2m_min")[i]),
    apparentMaxC: num(col(daily, "apparent_temperature_max")[i]),
    apparentMinC: num(col(daily, "apparent_temperature_min")[i]),
    precipitationSumMm: num(col(daily, "precipitation_sum")[i]),
    precipitationProbabilityMaxPct: num(col(daily, "precipitation_probability_max")[i]),
    windSpeedMaxKmh: num(col(daily, "wind_speed_10m_max")[i]),
    windGustsMaxKmh: num(col(daily, "wind_gusts_10m_max")[i]),
    uvIndexMax: num(col(daily, "uv_index_max")[i]),
    sunrise: str(col(daily, "sunrise")[i]),
    sunset: str(col(daily, "sunset")[i]),
  }));
}

export async function fetchForecast(
  place: Place,
  forecastDays = 7,
): Promise<Result<WeatherBundle>> {
  const url = buildUrl(FORECAST_URL, {
    latitude: place.latitude,
    longitude: place.longitude,
    current: CURRENT_VARS,
    hourly: HOURLY_VARS,
    daily: DAILY_VARS,
    timezone: place.timezone || "auto",
    forecast_days: Math.min(Math.max(forecastDays, 1), 16),
    wind_speed_unit: "kmh",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
  });

  const response = await getJson<OpenMeteoResponse>(url, { revalidate: 300 });
  if (!response.ok) return fail(`Open-Meteo forecast unavailable (${response.reason})`);

  const body = response.data;
  const hourly = buildHourly(body.hourly);
  const daily = buildDaily(body.daily);
  const rawCurrent = body.current;

  if (!rawCurrent && hourly.length === 0 && daily.length === 0) {
    return fail("Open-Meteo returned no usable data for this location");
  }

  const currentTime = str(rawCurrent?.time) ?? "";
  // `visibility` is not always populated under `current`; fall back to the matching hour.
  const matchingHour =
    hourly.find((row) => row.time.slice(0, 13) === currentTime.slice(0, 13)) ?? hourly[0];

  const current = rawCurrent
    ? {
        time: currentTime,
        temperatureC: num(rawCurrent.temperature_2m),
        apparentTemperatureC: num(rawCurrent.apparent_temperature),
        humidityPct: num(rawCurrent.relative_humidity_2m),
        precipitationMm: num(rawCurrent.precipitation),
        rainMm: num(rawCurrent.rain),
        precipitationProbabilityPct:
          num(rawCurrent.precipitation_probability) ??
          matchingHour?.precipitationProbabilityPct ??
          null,
        weatherCode: num(rawCurrent.weather_code),
        cloudCoverPct: num(rawCurrent.cloud_cover),
        pressureHpa: num(rawCurrent.pressure_msl),
        windSpeedKmh: num(rawCurrent.wind_speed_10m),
        windGustsKmh: num(rawCurrent.wind_gusts_10m),
        windDirectionDeg: num(rawCurrent.wind_direction_10m),
        visibilityM: num(rawCurrent.visibility) ?? matchingHour?.visibilityM ?? null,
        isDay: num(rawCurrent.is_day) === null ? null : num(rawCurrent.is_day) === 1,
      }
    : null;

  return ok({
    place: { ...place, timezone: body.timezone ?? place.timezone },
    current,
    hourly,
    daily,
    units: {
      temperature: "°C",
      wind: "km/h",
      precipitation: "mm",
      visibility: "m",
      pressure: "hPa",
    },
    retrievedAt: new Date().toISOString(),
  });
}

export interface GfsRow {
  time: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  pressureHpa: number | null;
}

/**
 * Raw hourly series from one NWP endpoint. Open-Meteo exposes several models on
 * parallel paths with an identical query shape, which is what lets the NWP
 * service treat them as interchangeable providers.
 */
export async function fetchNwpSeries(
  place: Place,
  endpoint: string,
  options: { models?: string; forecastDays?: number } = {},
): Promise<Result<{ place: Place; rows: GfsRow[]; retrievedAt: string }>> {
  const url = buildUrl(endpoint, {
    latitude: place.latitude,
    longitude: place.longitude,
    hourly: "temperature_2m,precipitation,wind_speed_10m,pressure_msl",
    models: options.models,
    timezone: place.timezone || "auto",
    forecast_days: Math.min(Math.max(options.forecastDays ?? 5, 1), 16),
    wind_speed_unit: "kmh",
  });

  const response = await getJson<OpenMeteoResponse>(url, { revalidate: 900 });
  if (!response.ok) return fail(`model data unavailable (${response.reason})`);

  const hourly = response.data.hourly;
  const rows: GfsRow[] = times(hourly).map((time, i) => ({
    time,
    temperatureC: num(col(hourly, "temperature_2m")[i]),
    precipitationMm: num(col(hourly, "precipitation")[i]),
    windSpeedKmh: num(col(hourly, "wind_speed_10m")[i]),
    pressureHpa: num(col(hourly, "pressure_msl")[i]),
  }));

  if (rows.length === 0) return fail("model returned no forecast rows for this location");

  return ok({
    place: { ...place, timezone: response.data.timezone ?? place.timezone },
    rows,
    retrievedAt: new Date().toISOString(),
  });
}

/** Real GFS model output. Used by the NWP service. */
export async function fetchGfs(
  place: Place,
  forecastDays = 5,
): Promise<Result<{ place: Place; rows: GfsRow[]; retrievedAt: string }>> {
  return fetchNwpSeries(place, GFS_URL, { models: "gfs_seamless", forecastDays });
}

export const NWP_ENDPOINTS = {
  gfs: GFS_URL,
  icon: "https://api.open-meteo.com/v1/dwd-icon",
  ecmwf: "https://api.open-meteo.com/v1/ecmwf",
} as const;


/** ERA5 reanalysis archive. Used by the historical/climate service. */
export async function fetchArchive(
  place: Place,
  startDate: string,
  endDate: string,
): Promise<Result<{ place: Place; rows: HistoricalDailyRow[]; retrievedAt: string }>> {
  const url = buildUrl(ARCHIVE_URL, {
    latitude: place.latitude,
    longitude: place.longitude,
    start_date: startDate,
    end_date: endDate,
    daily:
      "temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_sum",
    timezone: place.timezone || "auto",
  });

  const response = await getJson<OpenMeteoResponse>(url, { revalidate: 86_400 });
  if (!response.ok) return fail(`ERA5 historical archive unavailable (${response.reason})`);

  const daily = response.data.daily;
  const rows: HistoricalDailyRow[] = times(daily).map((date, i) => ({
    date,
    tempMaxC: num(col(daily, "temperature_2m_max")[i]),
    tempMinC: num(col(daily, "temperature_2m_min")[i]),
    tempMeanC: num(col(daily, "temperature_2m_mean")[i]),
    precipitationSumMm: num(col(daily, "precipitation_sum")[i]),
  }));

  if (rows.length === 0) {
    return fail(`ERA5 has no data for ${startDate}..${endDate} at this location`);
  }

  return ok({
    place: { ...place, timezone: response.data.timezone ?? place.timezone },
    rows,
    retrievedAt: new Date().toISOString(),
  });
}

/** Agronomic variables for the agriculture advisory layer. */
export async function fetchAgronomy(place: Place): Promise<Result<AgronomyBundle>> {
  const url = buildUrl(FORECAST_URL, {
    latitude: place.latitude,
    longitude: place.longitude,
    hourly: "soil_moisture_0_to_1cm,soil_temperature_0cm",
    daily: "et0_fao_evapotranspiration,precipitation_sum",
    timezone: place.timezone || "auto",
    forecast_days: 5,
  });

  const response = await getJson<OpenMeteoResponse>(url, { revalidate: 1800 });
  if (!response.ok) return fail(`Agronomic data unavailable (${response.reason})`);

  const { hourly, daily } = response.data;
  const dailyTimes = times(daily);

  return ok({
    place: { ...place, timezone: response.data.timezone ?? place.timezone },
    et0Mm: dailyTimes.map((date, i) => ({
      date,
      value: num(col(daily, "et0_fao_evapotranspiration")[i]),
    })),
    precipitationSumMm: dailyTimes.map((date, i) => ({
      date,
      value: num(col(daily, "precipitation_sum")[i]),
    })),
    soilMoisture0to1cm: times(hourly).map((time, i) => ({
      time,
      value: num(col(hourly, "soil_moisture_0_to_1cm")[i]),
    })),
    soilTemperature0cm: times(hourly).map((time, i) => ({
      time,
      value: num(col(hourly, "soil_temperature_0cm")[i]),
    })),
    retrievedAt: new Date().toISOString(),
  });
}
