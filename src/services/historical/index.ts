import "server-only";

import { cardId, describePlace, fmtMm, fmtTemp, round } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/http";
import { isoDateInZone } from "@/lib/time";
import type { WeatherCardData } from "@/lib/types";
import { fetchArchive } from "@/services/weather/openMeteo";
import type { HistoricalDailyRow, HistoricalSummary, Place } from "@/services/weather/types";

/**
 * Historical weather and climate, from the ERA5 reanalysis archive (Open-Meteo
 * archive API). This is real measured/reanalysed data back to 1940 - no mock
 * values anywhere in this module.
 *
 * ERA5 runs roughly 5 days behind real time, so requests are clamped to the last
 * available date and the clamp is reported back to the caller.
 */

const SOURCE = "ERA5 reanalysis via Open-Meteo archive API";
const ERA5_LAG_DAYS = 6;
const ERA5_EARLIEST = "1940-01-01";

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function pick(rows: HistoricalDailyRow[], key: keyof HistoricalDailyRow): number[] {
  return rows
    .map((row) => row[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function latestAvailableDate(timezone: string): string {
  const zone = timezone && timezone !== "auto" ? timezone : "UTC";
  const date = new Date(Date.now() - ERA5_LAG_DAYS * 86_400_000);
  return isoDateInZone(date, zone);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function clamp(date: string, min: string, max: string): string {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

export interface HistoricalResult {
  summary: HistoricalSummary;
  card: WeatherCardData;
  /** Present when the requested range was trimmed to what ERA5 actually covers. */
  clampNote?: string;
}

export async function getHistoricalSummary(
  place: Place,
  startDate: string,
  endDate: string,
  language: "en" | "hi" = "en",
): Promise<Result<HistoricalResult>> {
  if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
    return fail("dates must be in YYYY-MM-DD format");
  }

  const maxDate = latestAvailableDate(place.timezone);
  const start = clamp(startDate, ERA5_EARLIEST, maxDate);
  const end = clamp(endDate, ERA5_EARLIEST, maxDate);

  if (start > end) {
    return fail(
      `no historical data available for ${startDate}..${endDate}; the archive currently ends at ${maxDate}`,
    );
  }

  const clampNote =
    start !== startDate || end !== endDate
      ? `Requested ${startDate}..${endDate}; archive covers ${ERA5_EARLIEST}..${maxDate}, so the range used was ${start}..${end}.`
      : undefined;

  const archive = await fetchArchive(place, start, end);
  if (!archive.ok) return fail(archive.reason);

  const rows = archive.data.rows;
  const summary: HistoricalSummary = {
    place: archive.data.place,
    startDate: start,
    endDate: end,
    days: rows.length,
    meanTempC: mean(pick(rows, "tempMeanC")),
    meanTempMaxC: mean(pick(rows, "tempMaxC")),
    meanTempMinC: mean(pick(rows, "tempMinC")),
    highestTempC: pick(rows, "tempMaxC").length ? Math.max(...pick(rows, "tempMaxC")) : null,
    lowestTempC: pick(rows, "tempMinC").length ? Math.min(...pick(rows, "tempMinC")) : null,
    totalPrecipitationMm: pick(rows, "precipitationSumMm").length
      ? Math.round(pick(rows, "precipitationSumMm").reduce((a, b) => a + b, 0) * 10) / 10
      : null,
    // Cap the sample so a multi-year range does not blow up the tool result.
    sample: rows.length <= 40 ? rows : [...rows.slice(0, 20), ...rows.slice(-20)],
    retrievedAt: archive.data.retrievedAt,
  };

  const hi = language === "hi";
  const card: WeatherCardData = {
    id: cardId("historical"),
    kind: "historical",
    place: describePlace(summary.place),
    headline: `${start} → ${end} · ${hi ? "औसत" : "mean"} ${fmtTemp(summary.meanTempC)}`,
    subline: `${summary.days} ${hi ? "दिन का रिकॉर्ड" : "days of record"}`,
    metrics: [
      { label: hi ? "औसत तापमान" : "Mean temp", value: fmtTemp(summary.meanTempC) },
      { label: hi ? "औसत अधिकतम" : "Mean max", value: fmtTemp(summary.meanTempMaxC) },
      { label: hi ? "औसत न्यूनतम" : "Mean min", value: fmtTemp(summary.meanTempMinC) },
      { label: hi ? "सर्वाधिक" : "Highest", value: fmtTemp(summary.highestTempC) },
      { label: hi ? "सबसे कम" : "Lowest", value: fmtTemp(summary.lowestTempC) },
      { label: hi ? "कुल वर्षा" : "Total rain", value: fmtMm(summary.totalPrecipitationMm) },
    ],
    provenance: {
      dataKind: "historical",
      source: SOURCE,
      retrievedAt: summary.retrievedAt,
      isReal: true,
      note: clampNote,
    },
  };

  return ok({ summary, card, clampNote });
}

export interface YearAggregate {
  year: number;
  days: number;
  meanTempC: number | null;
  meanTempMaxC: number | null;
  totalPrecipitationMm: number | null;
}

export interface ClimateTrendResult {
  place: Place;
  startYear: number;
  endYear: number;
  /** 1-12 when the trend is restricted to a single month, else null. */
  month: number | null;
  perYear: YearAggregate[];
  /** Least-squares slope of mean temperature, °C per year. Null if under 3 years. */
  trendCPerYear: number | null;
  card: WeatherCardData;
  retrievedAt: string;
}

/**
 * Year-over-year climate trend from a single archive request, aggregated locally.
 * `month` restricts the comparison to one month across years (e.g. every May).
 */
export async function getClimateTrend(
  place: Place,
  startYear: number,
  endYear: number,
  options: { month?: number; language?: "en" | "hi" } = {},
): Promise<Result<ClimateTrendResult>> {
  const maxDate = latestAvailableDate(place.timezone);
  const maxYear = Number(maxDate.slice(0, 4));
  const from = Math.max(1940, Math.min(startYear, endYear));
  const to = Math.min(maxYear, Math.max(startYear, endYear));

  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) {
    return fail(`invalid year range; the archive covers 1940..${maxYear}`);
  }
  if (to - from > 40) return fail("year range too wide; request at most 40 years at a time");

  const month = options.month && options.month >= 1 && options.month <= 12 ? options.month : null;

  const archive = await fetchArchive(place, `${from}-01-01`, clampEnd(`${to}-12-31`, maxDate));
  if (!archive.ok) return fail(archive.reason);

  const buckets = new Map<number, HistoricalDailyRow[]>();
  for (const row of archive.data.rows) {
    if (month !== null && Number(row.date.slice(5, 7)) !== month) continue;
    const year = Number(row.date.slice(0, 4));
    const list = buckets.get(year);
    if (list) list.push(row);
    else buckets.set(year, [row]);
  }

  const perYear: YearAggregate[] = [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, rows]) => ({
      year,
      days: rows.length,
      meanTempC: mean(pick(rows, "tempMeanC")),
      meanTempMaxC: mean(pick(rows, "tempMaxC")),
      totalPrecipitationMm: pick(rows, "precipitationSumMm").length
        ? Math.round(pick(rows, "precipitationSumMm").reduce((a, b) => a + b, 0) * 10) / 10
        : null,
    }));

  if (perYear.length === 0) return fail("archive returned no rows for that range");

  const usable = perYear.filter(
    (y): y is YearAggregate & { meanTempC: number } => y.meanTempC !== null,
  );
  const trendCPerYear = usable.length >= 3 ? leastSquaresSlope(usable) : null;

  const hi = options.language === "hi";
  const first = perYear[0];
  const last = perYear[perYear.length - 1];
  const monthName = month
    ? new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
        new Date(Date.UTC(2000, month - 1, 1)),
      )
    : null;

  const card: WeatherCardData = {
    id: cardId("trend"),
    kind: "historical",
    place: describePlace(archive.data.place),
    headline: `${from}–${to}${monthName ? ` · ${monthName}` : ""} · ${
      trendCPerYear === null
        ? hi ? "रुझान अनुपलब्ध" : "trend n/a"
        : `${trendCPerYear >= 0 ? "+" : ""}${round(trendCPerYear, 3)} °C/${hi ? "वर्ष" : "yr"}`
    }`,
    subline: `${perYear.length} ${hi ? "वर्ष" : "years"} · ERA5`,
    metrics: [
      { label: `${first.year}`, value: fmtTemp(first.meanTempC), hint: `${first.days}d` },
      { label: `${last.year}`, value: fmtTemp(last.meanTempC), hint: `${last.days}d` },
      {
        label: hi ? "कुल बदलाव" : "Change",
        value:
          first.meanTempC !== null && last.meanTempC !== null
            ? `${last.meanTempC - first.meanTempC >= 0 ? "+" : ""}${round(
                last.meanTempC - first.meanTempC,
                1,
              )} °C`
            : "—",
      },
    ],
    daily: perYear.map((year) => ({
      date: `${year.year}`,
      label: `${year.year}`,
      maxC: year.meanTempMaxC,
      minC: year.meanTempC,
      precipProbability: null,
      precipMm: year.totalPrecipitationMm,
      conditionCode: null,
    })),
    provenance: {
      dataKind: "historical",
      source: SOURCE,
      retrievedAt: archive.data.retrievedAt,
      isReal: true,
      note: `Aggregated locally from daily ERA5 rows. Archive ends ${maxDate}, so ${to} may be partial.`,
    },
  };

  return ok({
    place: archive.data.place,
    startYear: from,
    endYear: to,
    month,
    perYear,
    trendCPerYear,
    card,
    retrievedAt: archive.data.retrievedAt,
  });
}

function clampEnd(date: string, maxDate: string): string {
  return date > maxDate ? maxDate : date;
}

function leastSquaresSlope(points: Array<{ year: number; meanTempC: number }>): number {
  const n = points.length;
  const meanX = points.reduce((a, p) => a + p.year, 0) / n;
  const meanY = points.reduce((a, p) => a + p.meanTempC, 0) / n;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.year - meanX) * (point.meanTempC - meanY);
    denominator += (point.year - meanX) ** 2;
  }
  return denominator === 0 ? 0 : Math.round((numerator / denominator) * 1000) / 1000;
}

export { latestAvailableDate };
