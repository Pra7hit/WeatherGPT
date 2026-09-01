import "server-only";

import { cardId, describePlace, fmtMm, fmtPressure, fmtTemp, fmtWind } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/http";
import { dateTimeLabel, hourLabel } from "@/lib/time";
import type { WeatherCardData } from "@/lib/types";
import { fetchNwpSeries, NWP_ENDPOINTS } from "@/services/weather/openMeteo";
import type { Place } from "@/services/weather/types";
import type { NwpForecast, NwpModelId, NwpModelInfo } from "./types";

/**
 * Numerical Weather Prediction abstraction.
 *
 * Models are registered here with an `available` flag and a fetcher. GFS, ICON
 * and ECMWF are wired to real Open-Meteo model endpoints. WRF has no data source
 * in this build, so it is registered as unavailable and every request for it
 * returns an explicit failure - the app never fabricates or mocks model output.
 *
 * Adding a real WRF feed later means providing a fetcher here; nothing upstream
 * of this file changes.
 */

type Fetcher = (
  place: Place,
  forecastDays: number,
) => ReturnType<typeof fetchNwpSeries>;

interface Registration {
  info: NwpModelInfo;
  fetch?: Fetcher;
}

const REGISTRY: Record<NwpModelId, Registration> = {
  gfs: {
    info: {
      id: "gfs",
      name: "GFS (Global Forecast System)",
      producer: "NOAA / NCEP",
      resolution: "~0.11°–0.25° global",
      available: true,
      note: "Real model output, served via Open-Meteo's gfs_seamless blend.",
    },
    fetch: (place, days) =>
      fetchNwpSeries(place, NWP_ENDPOINTS.gfs, {
        models: "gfs_seamless",
        forecastDays: days,
      }),
  },
  icon: {
    info: {
      id: "icon",
      name: "ICON",
      producer: "Deutscher Wetterdienst (DWD)",
      resolution: "~11 km global, ~2 km nested",
      available: true,
      note: "Real model output, served via Open-Meteo's DWD ICON endpoint.",
    },
    fetch: (place, days) =>
      fetchNwpSeries(place, NWP_ENDPOINTS.icon, { forecastDays: days }),
  },
  ecmwf: {
    info: {
      id: "ecmwf",
      name: "IFS",
      producer: "ECMWF",
      resolution: "~9–25 km global",
      available: true,
      note: "Real model output, served via Open-Meteo's ECMWF endpoint.",
    },
    fetch: (place, days) =>
      fetchNwpSeries(place, NWP_ENDPOINTS.ecmwf, { forecastDays: days }),
  },
  wrf: {
    info: {
      id: "wrf",
      name: "WRF (Weather Research and Forecasting)",
      producer: "NCAR / regional centres (e.g. IMD, IITM runs)",
      resolution: "configurable, typically 3–12 km regional",
      available: false,
      note:
        "No WRF data source is configured in this build. WRF output normally comes from a self-hosted run or an institutional feed (IMD/IITM). Requests return an explicit 'not configured' failure rather than sample data.",
    },
  },
};

export function listModels(): NwpModelInfo[] {
  return Object.values(REGISTRY).map((entry) => entry.info);
}

export function isNwpModelId(value: string): value is NwpModelId {
  return value in REGISTRY;
}

export interface NwpResult {
  forecast: NwpForecast;
  card: WeatherCardData;
}

export async function getNwpForecast(
  place: Place,
  modelId: NwpModelId,
  options: { forecastDays?: number; language?: "en" | "hi" } = {},
): Promise<Result<NwpResult>> {
  const registration = REGISTRY[modelId];
  if (!registration) return fail(`unknown NWP model "${modelId}"`);

  const { info, fetch: fetcher } = registration;
  if (!info.available || !fetcher) {
    return fail(`${info.name} is not configured in this deployment. ${info.note}`);
  }

  const days = Math.min(Math.max(options.forecastDays ?? 5, 1), 16);
  const series = await fetcher(place, days);
  if (!series.ok) return fail(`${info.name}: ${series.reason}`);

  const rows = series.data.rows;
  const language = options.language ?? "en";
  const hi = language === "hi";

  const forecast: NwpForecast = {
    model: info,
    place: series.data.place,
    rows,
    seriesStart: rows[0].time,
    seriesEnd: rows[rows.length - 1].time,
    modelRunInitTime: null,
    retrievedAt: series.data.retrievedAt,
  };

  const first = rows[0];
  const totalPrecip =
    Math.round(
      rows.reduce((sum, row) => sum + (row.precipitationMm ?? 0), 0) * 10,
    ) / 10;
  const peakWind = Math.max(0, ...rows.map((row) => row.windSpeedKmh ?? 0));

  const card: WeatherCardData = {
    id: cardId("nwp"),
    kind: "nwp",
    place: describePlace(forecast.place),
    headline: `${info.name} · ${fmtTemp(first.temperatureC)} ${hi ? "पर" : "at"} ${hourLabel(
      first.time,
      language,
    )}`,
    subline: `${info.producer} · ${info.resolution}`,
    metrics: [
      { label: hi ? "प्रारंभ" : "Series start", value: dateTimeLabel(forecast.seriesStart, language) },
      { label: hi ? "अंत" : "Series end", value: dateTimeLabel(forecast.seriesEnd, language) },
      { label: hi ? "कुल वर्षा" : "Total precip", value: fmtMm(totalPrecip) },
      { label: hi ? "अधिकतम हवा" : "Peak wind", value: fmtWind(peakWind) },
      { label: hi ? "दबाव" : "Pressure", value: fmtPressure(first.pressureHpa) },
      { label: hi ? "घंटे" : "Hours", value: String(rows.length) },
    ],
    hourly: rows.slice(0, 24).map((row) => ({
      time: row.time,
      label: hourLabel(row.time, language),
      tempC: row.temperatureC,
      precipProbability: null,
      conditionCode: null,
    })),
    provenance: {
      dataKind: "nwp",
      source: `${info.name} via Open-Meteo`,
      retrievedAt: forecast.retrievedAt,
      isReal: true,
      model: `${info.name} (${info.producer}, ${info.resolution})`,
      note: "Raw NWP model output. Exact model run initialisation time is not exposed by this endpoint.",
    },
  };

  return ok({ forecast, card });
}

export type { NwpForecast, NwpModelId, NwpModelInfo, NwpRow } from "./types";
