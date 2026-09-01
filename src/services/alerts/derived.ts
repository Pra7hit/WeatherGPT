import "server-only";

import { cardId, describePlace, fmtMm, fmtTemp, fmtVisibility, fmtWind } from "@/lib/format";
import { dayLabel } from "@/lib/time";
import type { AlertCardData, AlertSeverity } from "@/lib/types";
import { conditionText } from "@/services/weather/codes";
import type { WeatherBundle } from "@/services/weather/types";

/**
 * Forecast-derived risk advisories.
 *
 * These are NOT official warnings and are never labelled as such. Each one
 * carries the exact numbers that tripped its threshold so the answer can cite
 * evidence instead of asserting authority.
 *
 * Rain thresholds follow IMD's rainfall categories (heavy 64.5-115.5 mm/day,
 * very heavy 115.6-204.4, extremely heavy >204.4). Heat is expressed as
 * feels-like heat stress, deliberately not as an "IMD heatwave", because a real
 * heatwave declaration depends on departure from local normals plus IMD's own
 * criteria - which a point forecast cannot establish.
 */

const SOURCE = "Derived from Open-Meteo forecast values";

interface Draft {
  event: string;
  severity: AlertSeverity;
  description: string;
  evidence: string[];
  starts?: string;
  ends?: string;
}

function severityOf(value: number, thresholds: [number, AlertSeverity][]): AlertSeverity | null {
  for (const [limit, severity] of thresholds) {
    if (value >= limit) return severity;
  }
  return null;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  extreme: 0,
  severe: 1,
  moderate: 2,
  minor: 3,
  info: 4,
};

/**
 * One advisory per risk, not one per risk per day.
 *
 * The rules above run over each of the next five days, so a five-day heatwave
 * used to produce five identical cards. Collapsing by event keeps the worst day's
 * wording, records every affected date as evidence, and spans `starts`..`ends`.
 */
function collapseByEvent(drafts: Draft[]): Draft[] {
  const merged = new Map<string, Draft & { dates: string[] }>();

  for (const draft of drafts) {
    const existing = merged.get(draft.event);
    const date = draft.starts?.slice(0, 10);

    if (!existing) {
      merged.set(draft.event, {
        ...draft,
        evidence: [...draft.evidence],
        dates: date ? [date] : [],
      });
      continue;
    }

    const worse = SEVERITY_RANK[draft.severity] < SEVERITY_RANK[existing.severity];
    existing.severity = worse ? draft.severity : existing.severity;
    existing.description = worse ? draft.description : existing.description;
    existing.evidence.push(...draft.evidence);
    // Days are visited in order, so the first `starts` is the earliest.
    existing.ends = draft.ends ?? draft.starts ?? existing.ends;
    if (date && !existing.dates.includes(date)) existing.dates.push(date);
  }

  return [...merged.values()].map((draft) => {
    const evidence =
      draft.evidence.length > 6
        ? [...draft.evidence.slice(0, 6), `…and ${draft.evidence.length - 6} more forecast value(s)`]
        : draft.evidence;
    return {
      ...draft,
      description:
        draft.dates.length > 1
          ? `${draft.description} Forecast to affect ${draft.dates.length} days: ${draft.dates.join(", ")}.`
          : draft.description,
      evidence,
    };
  });
}

export function deriveAdvisories(bundle: WeatherBundle, language: "en" | "hi" = "en"): AlertCardData[] {
  const drafts: Draft[] = [];
  const place = describePlace(bundle.place);
  const days = bundle.daily.slice(0, 5);

  for (const day of days) {
    const when = dayLabel(day.date, language);

    // --- Rainfall ---
    const rain = day.precipitationSumMm;
    if (rain !== null) {
      const severity = severityOf(rain, [
        [204.5, "extreme"],
        [115.6, "severe"],
        [64.5, "moderate"],
      ]);
      if (severity) {
        const band =
          rain >= 204.5 ? "extremely heavy" : rain >= 115.6 ? "very heavy" : "heavy";
        drafts.push({
          event: `Heavy rainfall risk (${band})`,
          severity,
          description: `Forecast rainfall for ${when} falls in the ${band} category. Expect waterlogging and slow traffic; low-lying areas may be affected.`,
          evidence: [
            `Forecast rainfall ${fmtMm(rain)} on ${day.date}`,
            `Max rain probability ${day.precipitationProbabilityMaxPct ?? "n/a"}%`,
          ],
          starts: day.date,
        });

        if (rain >= 115.6) {
          drafts.push({
            event: "Possible flash-flooding / waterlogging",
            severity: rain >= 204.5 ? "extreme" : "severe",
            description: `Rainfall of this magnitude can cause flash flooding and urban waterlogging. Official flood warnings for India are issued by IMD and the Central Water Commission — check those before making decisions.`,
            evidence: [`Forecast rainfall ${fmtMm(rain)} on ${day.date}`],
            starts: day.date,
          });
        }
      }
    }

    // --- Thunderstorms ---
    if (day.weatherCode !== null && [95, 96, 99].includes(day.weatherCode)) {
      drafts.push({
        event: "Thunderstorm risk",
        severity: day.weatherCode === 99 ? "severe" : "moderate",
        description: `${conditionText(day.weatherCode, language)} is in the forecast for ${when}. Avoid open ground, tall isolated trees and rooftops during the storm.`,
        evidence: [`Forecast condition on ${day.date}: ${conditionText(day.weatherCode, "en")}`],
        starts: day.date,
      });
    }

    // --- Heat stress ---
    const feelsMax = day.apparentMaxC;
    if (feelsMax !== null) {
      const severity = severityOf(feelsMax, [
        [45, "extreme"],
        [40, "severe"],
        [37, "moderate"],
      ]);
      if (severity) {
        drafts.push({
          event: "High heat stress",
          severity,
          description: `Feels-like temperature reaches ${fmtTemp(feelsMax)} on ${when}. Limit outdoor exposure between 11:00 and 16:00, drink water often, and watch for heat exhaustion. This is a feels-like threshold, not an IMD heatwave declaration.`,
          evidence: [
            `Forecast feels-like max ${fmtTemp(feelsMax)} on ${day.date}`,
            `Forecast air temperature max ${fmtTemp(day.tempMaxC)}`,
          ],
          starts: day.date,
        });
      }
    }

    // --- Cold ---
    if (day.tempMinC !== null && day.tempMinC <= 10) {
      drafts.push({
        event: day.tempMinC <= 4 ? "Severe cold" : "Cold conditions",
        severity: day.tempMinC <= 4 ? "severe" : "minor",
        description: `Minimum temperature drops to ${fmtTemp(day.tempMinC)} on ${when}.`,
        evidence: [`Forecast minimum ${fmtTemp(day.tempMinC)} on ${day.date}`],
        starts: day.date,
      });
    }

    // --- Wind ---
    const gusts = day.windGustsMaxKmh;
    if (gusts !== null) {
      const severity = severityOf(gusts, [
        [90, "extreme"],
        [62, "severe"],
        [45, "moderate"],
      ]);
      if (severity) {
        drafts.push({
          event: "Strong wind risk",
          severity,
          description: `Wind gusts up to ${fmtWind(gusts)} are forecast for ${when}. Secure loose objects and hoardings; two-wheelers and high-sided vehicles are affected first.`,
          evidence: [
            `Forecast max gusts ${fmtWind(gusts)} on ${day.date}`,
            `Forecast max sustained wind ${fmtWind(day.windSpeedMaxKmh)}`,
          ],
          starts: day.date,
        });
      }
    }
  }

  // --- Low visibility (hourly) ---
  const foggy = bundle.hourly
    .slice(0, 48)
    .filter((row) => row.visibilityM !== null && row.visibilityM <= 1000);
  if (foggy.length > 0) {
    const worst = foggy.reduce((a, b) => ((a.visibilityM ?? 1e9) <= (b.visibilityM ?? 1e9) ? a : b));
    drafts.push({
      event: "Low visibility / fog",
      severity: (worst.visibilityM ?? 1000) <= 200 ? "severe" : "moderate",
      description: `Visibility drops to ${fmtVisibility(worst.visibilityM)} around ${worst.time}. Expect slower road travel and possible flight or rail delays.`,
      evidence: [
        `Lowest forecast visibility ${fmtVisibility(worst.visibilityM)} at ${worst.time}`,
        `${foggy.length} hour(s) below 1 km in the next 48 h`,
      ],
      starts: foggy[0].time,
      ends: foggy[foggy.length - 1].time,
    });
  }

  // --- Deep low pressure + damaging winds: flag conditions, defer cyclone status to IMD ---
  const currentPressure = bundle.current?.pressureHpa ?? null;
  const peakGusts = Math.max(0, ...days.map((d) => d.windGustsMaxKmh ?? 0));
  if (currentPressure !== null && currentPressure < 995 && peakGusts >= 62) {
    drafts.push({
      event: "Very low pressure with damaging winds",
      severity: "severe",
      description:
        "Mean sea-level pressure is unusually low while damaging gusts are forecast — a pattern consistent with an intense weather system. Cyclone status and tracks are declared only by IMD; check IMD cyclone bulletins directly.",
      evidence: [
        `Current mean sea-level pressure ${Math.round(currentPressure)} hPa`,
        `Peak forecast gusts ${fmtWind(peakGusts)} in the next 5 days`,
      ],
    });
  }

  const retrievedAt = bundle.retrievedAt;
  return collapseByEvent(drafts).map((draft) => ({
    id: cardId("advisory"),
    official: false,
    severity: draft.severity,
    event: draft.event,
    place,
    starts: draft.starts,
    ends: draft.ends,
    description: draft.description,
    evidence: draft.evidence,
    provenance: {
      dataKind: "derived_advisory",
      source: SOURCE,
      retrievedAt,
      isReal: true,
      note: "Threshold-based advisory computed from forecast values. Not an official warning.",
    },
  }));
}
