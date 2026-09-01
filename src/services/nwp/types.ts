import type { Place } from "@/services/weather/types";

export type NwpModelId = "gfs" | "icon" | "ecmwf" | "wrf";

export interface NwpModelInfo {
  id: NwpModelId;
  name: string;
  producer: string;
  /** Approximate native horizontal resolution. */
  resolution: string;
  /** False means no data source is wired up - requests return an explicit failure. */
  available: boolean;
  note: string;
}

export interface NwpRow {
  time: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  windSpeedKmh: number | null;
  pressureHpa: number | null;
}

export interface NwpForecast {
  model: NwpModelInfo;
  place: Place;
  rows: NwpRow[];
  /** First and last timestamps of the returned series. */
  seriesStart: string;
  seriesEnd: string;
  /**
   * The exact model run/initialisation timestamp is not exposed by the upstream
   * endpoint, so this is deliberately null rather than guessed.
   */
  modelRunInitTime: null;
  retrievedAt: string;
}
