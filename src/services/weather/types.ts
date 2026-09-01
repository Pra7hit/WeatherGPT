/** Normalised weather shapes. Providers map into these; nothing downstream sees raw API JSON. */

export interface Place {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
  country?: string;
  timezone: string;
}

export interface CurrentConditions {
  time: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  precipitationProbabilityPct: number | null;
  weatherCode: number | null;
  cloudCoverPct: number | null;
  pressureHpa: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  windDirectionDeg: number | null;
  visibilityM: number | null;
  isDay: boolean | null;
}

export interface HourlyForecastRow {
  time: string;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  precipitationProbabilityPct: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  windSpeedKmh: number | null;
  windGustsKmh: number | null;
  visibilityM: number | null;
}

export interface DailyForecastRow {
  date: string;
  weatherCode: number | null;
  tempMaxC: number | null;
  tempMinC: number | null;
  apparentMaxC: number | null;
  apparentMinC: number | null;
  precipitationSumMm: number | null;
  precipitationProbabilityMaxPct: number | null;
  windSpeedMaxKmh: number | null;
  windGustsMaxKmh: number | null;
  uvIndexMax: number | null;
  sunrise: string | null;
  sunset: string | null;
}

export interface WeatherBundle {
  place: Place;
  current: CurrentConditions | null;
  hourly: HourlyForecastRow[];
  daily: DailyForecastRow[];
  units: {
    temperature: "°C";
    wind: "km/h";
    precipitation: "mm";
    visibility: "m";
    pressure: "hPa";
  };
  retrievedAt: string;
}

export interface AgronomyBundle {
  place: Place;
  /** Daily reference evapotranspiration (FAO-56), mm/day. */
  et0Mm: Array<{ date: string; value: number | null }>;
  precipitationSumMm: Array<{ date: string; value: number | null }>;
  soilMoisture0to1cm: Array<{ time: string; value: number | null }>;
  soilTemperature0cm: Array<{ time: string; value: number | null }>;
  retrievedAt: string;
}

export interface HistoricalDailyRow {
  date: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  tempMeanC: number | null;
  precipitationSumMm: number | null;
}

export interface HistoricalSummary {
  place: Place;
  startDate: string;
  endDate: string;
  days: number;
  meanTempC: number | null;
  meanTempMaxC: number | null;
  meanTempMinC: number | null;
  highestTempC: number | null;
  lowestTempC: number | null;
  totalPrecipitationMm: number | null;
  /** Capped sample of the underlying rows, so the model can cite specific days. */
  sample: HistoricalDailyRow[];
  retrievedAt: string;
}
