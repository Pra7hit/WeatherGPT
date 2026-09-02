"use client";

import { fmtTemp } from "@/lib/format";
import type { DailyPoint, DataKind, Language, WeatherCardData } from "@/lib/types";
import { t, uiLang } from "@/lib/uiText";
import { condition } from "@/services/weather/codes";

import { BarField } from "./BarField";
import { ConditionIcon } from "./icons";

/**
 * The data plate shown under an answer.
 *
 * The prose is the answer; this is the receipt. It is ruled top and bottom and
 * it is not a card: no rounding, no shadow, no tinted surface — the plate is the
 * same ground as the page, and the rules do the containing.
 *
 * Every plate ends with the source, the model where there is one, and the
 * fetch time, so a reader can tell an observation from a forecast from a model
 * run without trusting the sentence above it.
 */

/* The claim-kind signatures. Six kinds of claim have to stay apart with no
   colour available, so each carries its own ink coverage — always beside the
   kind's name in words, so the pattern is never the only signal. The advisory
   is the one that matters most: a dashed outline that is never filled, so it
   cannot be mistaken for the solid block an official warning gets. */
const SIGNATURE: Record<DataKind, { chip: string; swatch: string | null }> = {
  observation: { chip: "border-ink", swatch: "field-bars" },
  forecast: { chip: "border-ink", swatch: "field-diagonal" },
  historical: { chip: "border-ink", swatch: "field-dither" },
  nwp: { chip: "border-ink", swatch: "lattice" },
  official_warning: { chip: "field-solid border-ink", swatch: null },
  derived_advisory: { chip: "border-ink border-dashed", swatch: null },
  location: { chip: "border-hair-3", swatch: null },
};

function retrievedLabel(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(uiLang(language) === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** The kind chip: a swatch of the signature, then the kind in words. */
function KindChip({ kind, label }: { kind: DataKind; label: string }) {
  const signature = SIGNATURE[kind] ?? SIGNATURE.location;
  return (
    <span
      className={`mono-label inline-flex shrink-0 items-center gap-1.5 border px-1.5 py-1 ${signature.chip}`}
    >
      {signature.swatch ? (
        <span aria-hidden="true" className={`border-hair-3 h-2.5 w-4 border ${signature.swatch}`} />
      ) : null}
      {label}
    </span>
  );
}

/** The shared vertical scale for the daily band, taken from the days on screen. */
function dailyRange(days: DailyPoint[]): { low: number; span: number } | null {
  const values: number[] = [];
  for (const day of days) {
    if (day.minC !== null && Number.isFinite(day.minC)) values.push(day.minC);
    if (day.maxC !== null && Number.isFinite(day.maxC)) values.push(day.maxC);
  }
  if (values.length === 0) return null;
  const low = Math.min(...values);
  const high = Math.max(...values);
  return { low, span: high - low || 1 };
}

function dailyLabel(day: DailyPoint): string {
  if (day.maxC === null && day.minC === null) return "—";
  return `${fmtTemp(day.maxC)} / ${fmtTemp(day.minC)}`;
}

function rainLabel(day: DailyPoint): string {
  if (day.precipProbability !== null && Number.isFinite(day.precipProbability)) {
    return `${Math.round(day.precipProbability)}%`;
  }
  if (day.precipMm !== null && Number.isFinite(day.precipMm)) return `${day.precipMm}mm`;
  return "—";
}

/**
 * The subline qualifies the headline, but several providers build it out of the
 * very pairs the metric grid prints two lines below — "Feels like 33°C" directly
 * above "FEELS LIKE ... 33°C". Rather than trimming each provider's copy, the
 * plate drops a subline the table is about to repeat in full. Nothing is lost:
 * the grid is the complete record, and a subline with anything new in it stays.
 */
function liveSubline(card: WeatherCardData): string | null {
  const subline = card.subline?.trim();
  if (!subline) return null;

  const fold = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
  const tabled = card.metrics
    .map((metric) => fold(metric.value))
    .filter((value) => value.length > 1 && value !== "—");

  const parts = subline.split("·").map(fold).filter(Boolean);
  const repeated = (part: string) => tabled.some((value) => part.endsWith(value));
  return parts.length > 0 && parts.every(repeated) ? null : subline;
}

export function WeatherCard({ card, language }: { card: WeatherCardData; language: Language }) {
  const copy = t(language);
  const lang = uiLang(language);
  const hasCode = card.conditionCode !== undefined && card.conditionCode !== null;
  const days = card.daily ?? [];
  const range = dailyRange(days);
  const subline = liveSubline(card);

  return (
    <section className="mt-4">
      {/* The plate's head rule draws itself once, left to right, at the same
          constant rate as a series. Ruled top and bottom — never a card. */}
      <span aria-hidden="true" className="animate-draw bg-ink block h-[2px]" />

      <header className="flex items-start justify-between gap-3 pt-2">
        <div className="min-w-0">
          <p className="mono-label truncate">{card.place}</p>
          <div className="mt-1 flex items-center gap-2">
            {hasCode ? (
              <ConditionIcon
                icon={condition(card.conditionCode ?? null).icon}
                className="h-6 w-6 shrink-0"
              />
            ) : null}
            <h3 className="numeric text-plate">{card.headline}</h3>
          </div>
          {subline ? <p className="text-caption mt-1">{subline}</p> : null}
        </div>
        <KindChip kind={card.provenance.dataKind} label={copy.kind[card.provenance.dataKind]} />
      </header>

      {card.metrics.length > 0 ? (
        <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
          {card.metrics.map((metric) => (
            <div key={metric.label} className="border-hair flex items-baseline gap-2 border-t py-1.5">
              <dt className="mono-label shrink-0">{metric.label}</dt>
              <dd className="flex min-w-0 flex-1 items-baseline gap-2">
                <span aria-hidden="true" className="leader" />
                <span className="numeric text-caption shrink-0">{metric.value}</span>
                {metric.hint ? <span className="mono-label shrink-0">{metric.hint}</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {card.hourly && card.hourly.length > 0 ? (
        <BarField points={card.hourly} language={language} />
      ) : null}

      {days.length > 0 ? (
        <div className="mt-4">
          <div className="mono-label flex flex-wrap items-baseline justify-between gap-x-4">
            <span>{copy.daily}</span>
            {range ? (
              <span className="numeric">
                {copy.tempAxis} {Math.round(range.low)}–{Math.round(range.low + range.span)}
              </span>
            ) : null}
          </div>

          <ul>
            {days.map((day, index) => {
              const low = day.minC !== null && Number.isFinite(day.minC) ? day.minC : null;
              const high = day.maxC !== null && Number.isFinite(day.maxC) ? day.maxC : null;
              // The span bar is the day's own min→max on the shared scale. It is
              // measured data, so it is solid ink; the ruler behind it is not.
              const span =
                range && low !== null && high !== null
                  ? {
                      left: ((low - range.low) / range.span) * 100,
                      width: Math.max(2, ((high - low) / range.span) * 100),
                    }
                  : null;

              return (
                <li key={day.date} className="border-hair flex items-center gap-2.5 border-t py-2">
                  <span className="mono-label w-[3.6rem] shrink-0 truncate">{day.label}</span>
                  <ConditionIcon
                    icon={condition(day.conditionCode).icon}
                    className="hidden h-4 w-4 shrink-0 sm:block"
                  />
                  <span className="lattice relative h-2.5 min-w-8 flex-1">
                    {span ? (
                      <span
                        className="animate-draw bg-ink absolute inset-y-0"
                        style={{
                          left: `${span.left}%`,
                          width: `${span.width}%`,
                          animationDelay: `${Math.min(index, 6) * 60}ms`,
                        }}
                      />
                    ) : null}
                  </span>
                  <span className="mono-label w-9 shrink-0 text-right">{rainLabel(day)}</span>
                  <span className="numeric text-caption w-[5.4rem] shrink-0 text-right">
                    {dailyLabel(day)}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* The band as text, for a screen reader that cannot see a bar. */}
          <ul className="sr-only">
            {days.map((day) => (
              <li key={`sr-${day.date}`}>
                {day.label}: {dailyLabel(day)}, {copy.rainAxis} {rainLabel(day)}
                {day.conditionCode === null || day.conditionCode === undefined
                  ? ""
                  : `, ${lang === "hi" ? condition(day.conditionCode).hi : condition(day.conditionCode).en}`}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="border-ink mt-3 border-t pt-1.5">
        {/* Each entry is boxed on a hairline rather than separated by a space:
            SOURCE and RETRIEVED ran together into one string when the values
            wrapped, and provenance is the last thing that should read as mush. */}
        <dl className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <div className="border-hair-3 flex items-baseline gap-1.5 border-l pl-1.5">
            <dt className="mono-label">{copy.source}</dt>
            <dd className="numeric text-micro">{card.provenance.source}</dd>
          </div>
          {card.provenance.model ? (
            <div className="border-hair-3 flex items-baseline gap-1.5 border-l pl-1.5">
              <dt className="mono-label">{copy.model}</dt>
              <dd className="numeric text-micro">{card.provenance.model}</dd>
            </div>
          ) : null}
          <div className="border-hair-3 flex items-baseline gap-1.5 border-l pl-1.5">
            <dt className="mono-label">{copy.retrieved}</dt>
            <dd className="numeric text-micro">
              {retrievedLabel(card.provenance.retrievedAt, language)}
            </dd>
          </div>
        </dl>
        {card.provenance.note ? (
          <p className="numeric text-caption mt-1">{card.provenance.note}</p>
        ) : null}
      </footer>
    </section>
  );
}
