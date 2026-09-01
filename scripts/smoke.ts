/**
 * Service-level smoke test: calls every data service directly and prints the real
 * values it got back, before the AI layer is involved. If this passes, the numbers
 * the assistant quotes are coming from live providers.
 *
 *   npm run smoke
 *
 * Run with `--conditions=react-server` (see package.json) so the `server-only`
 * marker used by the service modules resolves to its empty build outside Next.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Minimal .env.local reader: Next loads it automatically, a bare tsx run does not. */
function loadEnvLocal(): void {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env.local: every provider exercised below is keyless, so keep going.
  }
}

let passed = 0;
let failed = 0;

async function step(name: string, run: () => Promise<string>): Promise<void> {
  const started = Date.now();
  try {
    const detail = await run();
    passed += 1;
    console.log(`PASS  ${name}  (${Date.now() - started} ms)`);
    for (const line of detail.split("\n")) console.log(`      ${line}`);
  } catch (error) {
    failed += 1;
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL  ${name}  (${Date.now() - started} ms)`);
    console.log(`      ${message}`);
  }
}

/** Unwraps a service Result, turning `{ ok: false }` into a thrown error. */
function must<T>(
  result: { ok: true; data: T } | { ok: false; reason: string },
  what: string,
): T {
  if (!result.ok) throw new Error(`${what}: ${result.reason}`);
  return result.data;
}

function num(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : String(value);
}

async function main(): Promise<void> {
  loadEnvLocal();

  // Imported after the env file is read, because env.ts snapshots process.env on load.
  const { geocode, reverseGeocode } = await import("@/services/location");
  const { getCurrentWeather, getForecast } = await import("@/services/weather");
  const { getAlerts } = await import("@/services/alerts");
  const { getActivityAdvisory, getAgricultureAdvisory } = await import("@/services/advisory");
  const { getClimateTrend, getHistoricalSummary, latestAvailableDate } = await import(
    "@/services/historical"
  );
  const { getNwpForecast, listModels } = await import("@/services/nwp");
  const { providerStatus } = await import("@/lib/env");
  const { isoDateInZone } = await import("@/lib/time");

  const status = providerStatus();
  console.log("WeatherGPT service smoke test");
  console.log(
    `providers: llm=${status.llm ? status.llmModel : "not configured (fallback mode)"} · ` +
      `weather=${status.weather} · historical=${status.historical} · ` +
      `nwpGfs=${status.nwpGfs} · nwpWrf=${status.nwpWrf} · ` +
      `officialAlerts=${status.officialAlerts ? "configured" : "not configured"}`,
  );
  console.log("");

  const delhi = must(await geocode("Delhi"), "geocode Delhi")[0];
  const zone = delhi.timezone === "auto" ? "Asia/Kolkata" : delhi.timezone;
  const today = isoDateInZone(new Date(), zone);
  const tomorrow = isoDateInZone(new Date(Date.now() + 86_400_000), zone);

  await step("geocode: Delhi resolves to real coordinates", async () => {
    const places = must(await geocode("Delhi"), "geocode");
    return places
      .slice(0, 3)
      .map(
        (place) =>
          `${place.name}, ${place.admin1 ?? "?"}, ${place.country ?? "?"} → ` +
          `${place.latitude}, ${place.longitude} (${place.timezone})`,
      )
      .join("\n");
  });

  await step("geocode: fictional city must fail, not invent a place", async () => {
    const result = await geocode("Zyxwvutsraq City");
    if (result.ok) throw new Error(`expected failure, got ${result.data.length} place(s)`);
    return `refused as expected: ${result.reason}`;
  });

  await step("reverse geocode: coordinates → place name", async () => {
    const place = must(await reverseGeocode(19.076, 72.8777), "reverseGeocode");
    return `19.076, 72.8777 → ${place.name}, ${place.admin1 ?? "?"}, ${place.country ?? "?"}`;
  });

  await step("current weather: Delhi observation", async () => {
    const { bundle, card } = must(await getCurrentWeather(delhi), "getCurrentWeather");
    const current = bundle.current!;
    return [
      `${card.place} · ${card.headline}`,
      `obs time ${current.time} (${bundle.place.timezone}) · humidity ${num(
        current.humidityPct,
      )}% · wind ${num(current.windSpeedKmh)} km/h · gusts ${num(current.windGustsKmh)} km/h`,
      `rain chance ${num(current.precipitationProbabilityPct)}% · precip ${num(
        current.precipitationMm,
      )} mm · visibility ${num(current.visibilityM)} m · pressure ${num(current.pressureHpa)} hPa`,
      `provenance: ${card.provenance.dataKind} · ${card.provenance.source}`,
    ].join("\n");
  });

  await step(`forecast: Delhi tomorrow (${tomorrow}) + 7 days`, async () => {
    const { bundle, card } = must(
      await getForecast(delhi, { date: tomorrow, days: 7 }),
      "getForecast",
    );
    const day = bundle.daily.find((row) => row.date === tomorrow);
    if (!day) throw new Error(`provider returned no daily row for ${tomorrow}`);
    return [
      `${card.headline}`,
      `max ${num(day.tempMaxC)} °C / min ${num(day.tempMinC)} °C · rain chance ${num(
        day.precipitationProbabilityMaxPct,
      )}% · precip ${num(day.precipitationSumMm)} mm`,
      `daily rows: ${bundle.daily.map((row) => row.date).join(", ")}`,
      `hourly rows in card: ${card.hourly?.length ?? 0}`,
    ].join("\n");
  });

  await step("forecast: part-of-day narrowing (tomorrow evening)", async () => {
    const { card } = must(
      await getForecast(delhi, { date: tomorrow, partOfDay: "evening", days: 3 }),
      "getForecast evening",
    );
    const hours = (card.hourly ?? []).map((point) => point.time.slice(11, 16));
    if (hours.length === 0) throw new Error("no hourly rows for the evening window");
    return `${card.headline}\nhours used: ${hours.join(", ")}`;
  });

  await step("alerts: official channel status + derived advisories", async () => {
    const alerts = must(await getAlerts(delhi, { language: "en" }), "getAlerts");
    const lines = [
      `official channel: ${
        alerts.official.configured
          ? `configured via ${alerts.official.provider} · ${alerts.official.alerts.length} active`
          : "NOT configured (no OPENWEATHER_API_KEY) → app must say so, not invent a warning"
      }${alerts.official.error ? ` · lookup error: ${alerts.official.error}` : ""}`,
      `derived advisories: ${alerts.derived.length}`,
    ];
    for (const advisory of alerts.derived) {
      if (advisory.official) throw new Error(`derived advisory ${advisory.id} claims official=true`);
      lines.push(
        `  [${advisory.severity}] ${advisory.event} — ${(advisory.evidence ?? []).join("; ")}`,
      );
    }
    for (const warning of alerts.official.alerts) {
      if (!warning.official || !warning.authority) {
        throw new Error(`official alert ${warning.id} is missing official/authority`);
      }
      lines.push(`  OFFICIAL [${warning.severity}] ${warning.event} — ${warning.authority}`);
    }
    return lines.join("\n");
  });

  await step("advisory: umbrella tomorrow (thresholds over real hourly rows)", async () => {
    const { facts } = must(
      await getActivityAdvisory(delhi, "umbrella", { date: tomorrow }),
      "getActivityAdvisory",
    );
    return [
      `window ${facts.windowLabel} (${facts.from} → ${facts.to}, ${facts.hoursConsidered} h)`,
      `rain chance max ${num(facts.maxPrecipProbabilityPct)}% · precip ${num(
        facts.totalPrecipitationMm,
      )} mm · feels-like max ${num(facts.maxApparentC)} °C · gusts ${num(facts.maxGustsKmh)} km/h`,
      `flags: ${Object.entries(facts.flags)
        .filter(([, on]) => on)
        .map(([flag]) => flag)
        .join(", ") || "none tripped"}`,
    ].join("\n");
  });

  await step("agriculture: real agronomic variables (ET0, soil moisture/temp)", async () => {
    const nashik = must(await geocode("Nashik"), "geocode Nashik")[0];
    const { facts } = must(await getAgricultureAdvisory(nashik), "getAgricultureAdvisory");
    return [
      `${facts.place} · ${facts.days.length} day(s)`,
      `ET0 total ${num(facts.totalEt0Mm)} mm · rain total ${num(facts.totalRainMm)} mm · ` +
        `balance ${num(facts.cumulativeBalanceMm)} mm · rain next 48 h ${num(facts.rainNext48hMm)} mm`,
      `soil moisture 0-1 cm ${num(facts.soilMoisture0to1cm?.valueM3M3)} m³/m³ at ${
        facts.soilMoisture0to1cm?.time ?? "—"
      } · soil temp 0 cm ${num(facts.soilTemperature0cm?.valueC)} °C`,
      `flags: ${Object.entries(facts.flags)
        .filter(([, on]) => on)
        .map(([flag]) => flag)
        .join(", ") || "none tripped"}`,
    ].join("\n");
  });

  await step("historical: ERA5 archive window", async () => {
    const archiveEnd = latestAvailableDate(zone);
    const start = isoDateInZone(new Date(Date.parse(`${archiveEnd}T00:00:00Z`) - 6 * 86_400_000), "UTC");
    const { summary, clampNote } = must(
      await getHistoricalSummary(delhi, start, archiveEnd),
      "getHistoricalSummary",
    );
    return [
      `${summary.startDate} → ${summary.endDate} · ${summary.days} day(s) of record`,
      `mean ${num(summary.meanTempC)} °C · mean max ${num(summary.meanTempMaxC)} °C · ` +
        `high ${num(summary.highestTempC)} °C · low ${num(summary.lowestTempC)} °C · ` +
        `rain ${num(summary.totalPrecipitationMm)} mm`,
      `archive ends ${archiveEnd}${clampNote ? ` · ${clampNote}` : ""}`,
    ].join("\n");
  });

  await step("climate: multi-year trend for one month", async () => {
    const thisYear = Number(today.slice(0, 4));
    const trend = must(
      await getClimateTrend(delhi, thisYear - 9, thisYear - 1, { month: 5 }),
      "getClimateTrend",
    );
    return [
      `May ${trend.startYear}–${trend.endYear} · slope ${num(trend.trendCPerYear)} °C/yr`,
      trend.perYear
        .map((year) => `${year.year}: ${num(year.meanTempC)} °C (${year.days} d)`)
        .join(" · "),
    ].join("\n");
  });

  await step("NWP: GFS returns real model output", async () => {
    const { forecast, card } = must(
      await getNwpForecast(delhi, "gfs", { forecastDays: 3 }),
      "getNwpForecast gfs",
    );
    if (!card.provenance.isReal) throw new Error("GFS result is not marked as real data");
    return [
      `${forecast.model.name} (${forecast.model.producer}, ${forecast.model.resolution})`,
      `${forecast.rows.length} hourly rows · ${forecast.seriesStart} → ${forecast.seriesEnd}`,
      `first row: ${num(forecast.rows[0].temperatureC)} °C · ${num(
        forecast.rows[0].precipitationMm,
      )} mm · ${num(forecast.rows[0].windSpeedKmh)} km/h · ${num(forecast.rows[0].pressureHpa)} hPa`,
    ].join("\n");
  });

  await step("NWP: WRF must report not configured, never mock data", async () => {
    const result = await getNwpForecast(delhi, "wrf");
    if (result.ok) throw new Error("WRF returned data — this build has no WRF source");
    return [
      `refused as expected: ${result.reason}`,
      `registry: ${listModels()
        .map((model) => `${model.id}=${model.available ? "available" : "unavailable"}`)
        .join(", ")}`,
    ].join("\n");
  });

  console.log("");
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
