import "server-only";

import { cardId, describePlace, fmtMm, fmtTemp, round, roundTo } from "@/lib/format";
import { fail, ok, type Result } from "@/lib/http";
import { dayLabel } from "@/lib/time";
import type { WeatherCardData } from "@/lib/types";
import { fetchAgronomy } from "@/services/weather/openMeteo";
import type { AgronomyBundle, Place } from "@/services/weather/types";

/**
 * Agriculture advisory layer.
 *
 * An irrigation answer here rests on real agronomic variables from Open-Meteo:
 * FAO-56 reference evapotranspiration (ET0), forecast rainfall, surface soil
 * moisture and soil temperature. This module computes the water balance
 * (rain - ET0) and hands the numbers to the model; it deliberately does not
 * encode crop-specific coefficients, root-zone depths or sowing calendars,
 * because none of that is available from the data source and inventing it would
 * be an unsupported agricultural claim.
 */

const SOURCE = "Open-Meteo forecast API (FAO-56 ET0, soil moisture, soil temperature)";

/** Surface layer only - 0-1 cm dries within hours and is not a root-zone measure. */
const SURFACE_DRY_M3M3 = 0.1;

export interface AgricultureDay {
  date: string;
  et0Mm: number | null;
  rainMm: number | null;
  /** rain - ET0 for the day. Negative means the day loses more water than it gains. */
  waterBalanceMm: number | null;
}

export interface AgricultureFlags {
  /** At least 5 mm of rain forecast within the next 48 hours. */
  rainExpectedNext48h: boolean;
  /** Cumulative rain - ET0 over the covered days is negative. */
  waterDeficit: boolean;
  /** ET0 for the first covered day is 5 mm or more. */
  highEvaporativeDemand: boolean;
  /** Latest surface soil moisture below 0.10 m3/m3. Surface layer, not root zone. */
  surfaceSoilDry: boolean;
}

export interface AgricultureFacts {
  place: string;
  days: AgricultureDay[];
  totalEt0Mm: number | null;
  totalRainMm: number | null;
  cumulativeBalanceMm: number | null;
  rainNext48hMm: number | null;
  /** Nearest available reading to the current local hour, with its timestamp. */
  soilMoisture0to1cm: { time: string; valueM3M3: number | null } | null;
  soilTemperature0cm: { time: string; valueC: number | null } | null;
  flags: AgricultureFlags;
  caveats: string[];
}

export interface AgricultureAdvisoryResult {
  facts: AgricultureFacts;
  card: WeatherCardData;
}

/** "YYYY-MM-DDTHH" for the current moment in `timezone`, matching Open-Meteo's naive-local stamps. */
function nowStampInZone(timezone: string): string {
  const zone = timezone && timezone !== "auto" ? timezone : "UTC";
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
  } catch {
    return new Date().toISOString().slice(0, 13);
  }
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}`;
}

function nearestReading(
  series: Array<{ time: string; value: number | null }>,
  stamp: string,
): { time: string; value: number | null } | null {
  if (series.length === 0) return null;
  const exact = series.find((row) => row.time.slice(0, 13) === stamp && row.value !== null);
  if (exact) return exact;
  const populated = series.filter((row) => row.value !== null);
  if (populated.length === 0) return series[0];
  // Series are chronological, so the last row at or before now is the freshest reading.
  const past = populated.filter((row) => row.time.slice(0, 13) <= stamp);
  return past.length > 0 ? past[past.length - 1] : populated[0];
}

function sum(values: Array<number | null>): number | null {
  const numbers = values.filter((value): value is number => value !== null);
  if (numbers.length === 0) return null;
  return roundTo(numbers.reduce((a, b) => a + b, 0), 1);
}

function buildDays(agronomy: AgronomyBundle): AgricultureDay[] {
  const rainByDate = new Map(agronomy.precipitationSumMm.map((row) => [row.date, row.value]));
  return agronomy.et0Mm.map((row) => {
    const rainMm = rainByDate.get(row.date) ?? null;
    return {
      date: row.date,
      et0Mm: row.value,
      rainMm,
      waterBalanceMm:
        row.value !== null && rainMm !== null ? roundTo(rainMm - row.value, 1) : null,
    };
  });
}

export async function getAgricultureAdvisory(
  place: Place,
  options: { language?: "en" | "hi" } = {},
): Promise<Result<AgricultureAdvisoryResult>> {
  const agronomy = await fetchAgronomy(place);
  if (!agronomy.ok) return fail(agronomy.reason);

  const data = agronomy.data;
  const days = buildDays(data);
  if (days.length === 0) {
    return fail("no agronomic forecast rows available for this location");
  }

  const stamp = nowStampInZone(data.place.timezone);
  const moisture = nearestReading(data.soilMoisture0to1cm, stamp);
  const soilTemp = nearestReading(data.soilTemperature0cm, stamp);

  const totalEt0Mm = sum(days.map((day) => day.et0Mm));
  const totalRainMm = sum(days.map((day) => day.rainMm));
  const rainNext48hMm = sum(days.slice(0, 2).map((day) => day.rainMm));
  const cumulativeBalanceMm =
    totalEt0Mm !== null && totalRainMm !== null ? roundTo(totalRainMm - totalEt0Mm, 1) : null;

  const facts: AgricultureFacts = {
    place: describePlace(data.place),
    days,
    totalEt0Mm,
    totalRainMm,
    cumulativeBalanceMm,
    rainNext48hMm,
    soilMoisture0to1cm: moisture ? { time: moisture.time, valueM3M3: moisture.value } : null,
    soilTemperature0cm: soilTemp ? { time: soilTemp.time, valueC: soilTemp.value } : null,
    flags: {
      rainExpectedNext48h: (rainNext48hMm ?? 0) >= 5,
      waterDeficit: cumulativeBalanceMm !== null && cumulativeBalanceMm < 0,
      highEvaporativeDemand: (days[0]?.et0Mm ?? 0) >= 5,
      surfaceSoilDry: moisture?.value != null && moisture.value < SURFACE_DRY_M3M3,
    },
    caveats: [
      "ET0 is FAO-56 reference evapotranspiration for a grass reference surface, not crop water use. Crop demand depends on the crop coefficient for its growth stage, which this data source does not provide.",
      "Soil moisture is the 0-1 cm surface layer, which dries within hours and does not represent root-zone moisture.",
      "No crop type, sowing date, soil texture or irrigation system is known here, so any recommendation is general guidance, not a prescription.",
    ],
  };

  const hi = options.language === "hi";
  const card: WeatherCardData = {
    id: cardId("agri"),
    kind: "agriculture",
    place: facts.place,
    headline: `${hi ? "जल संतुलन" : "Water balance"} ${
      cumulativeBalanceMm === null
        ? "—"
        : `${cumulativeBalanceMm >= 0 ? "+" : ""}${cumulativeBalanceMm} mm`
    } · ${days.length} ${hi ? "दिन" : "days"}`,
    subline: `${hi ? "वर्षा" : "Rain"} ${fmtMm(totalRainMm)} · ET₀ ${fmtMm(totalEt0Mm)}`,
    metrics: [
      { label: hi ? "अगले 48 घंटे वर्षा" : "Rain next 48h", value: fmtMm(rainNext48hMm) },
      { label: hi ? "कुल ET₀" : "Total ET₀", value: fmtMm(totalEt0Mm) },
      {
        label: hi ? "मिट्टी की नमी" : "Soil moisture",
        value:
          facts.soilMoisture0to1cm?.valueM3M3 != null
            ? `${round(facts.soilMoisture0to1cm.valueM3M3, 3)} m³/m³`
            : "—",
        hint: hi ? "0–1 सेमी सतह" : "0–1 cm surface",
      },
      {
        label: hi ? "मिट्टी का तापमान" : "Soil temp",
        value: fmtTemp(facts.soilTemperature0cm?.valueC ?? null),
        hint: hi ? "0 सेमी" : "0 cm",
      },
      {
        label: hi ? "वाष्पन मांग" : "Evaporative demand",
        value: fmtMm(days[0]?.et0Mm ?? null),
        hint: days[0] ? dayLabel(days[0].date, options.language ?? "en") : undefined,
      },
      {
        label: hi ? "दिन" : "Days covered",
        value: String(days.length),
      },
    ],
    daily: days.map((day) => ({
      date: day.date,
      label: dayLabel(day.date, options.language ?? "en"),
      maxC: null,
      minC: null,
      precipProbability: null,
      precipMm: day.rainMm,
      conditionCode: null,
    })),
    provenance: {
      dataKind: "derived_advisory",
      source: SOURCE,
      retrievedAt: data.retrievedAt,
      isReal: true,
      note: "Real agronomic variables; the water balance is computed locally. Irrigation guidance built on it is advisory, not an agronomic prescription.",
    },
  };

  return ok({ facts, card });
}
