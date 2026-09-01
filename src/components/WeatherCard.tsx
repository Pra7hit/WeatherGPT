"use client";

import { fmtTemp } from "@/lib/format";
import type { Language, WeatherCardData } from "@/lib/types";
import { t, uiLang } from "@/lib/uiText";
import { condition } from "@/services/weather/codes";

import { ConditionIcon } from "./icons";

/**
 * The compact data card shown under an answer.
 *
 * The prose is the answer; this is the receipt. Every card ends with a
 * provenance footer naming the source, the kind of claim it supports and when it
 * was fetched, so a reader can tell an observation from a forecast from a model
 * run without trusting the sentence above it.
 */

const KIND_STYLES: Record<string, string> = {
  observation: "bg-observation text-observation-ink",
  forecast: "bg-forecast text-forecast-ink",
  historical: "bg-historical text-historical-ink",
  nwp: "bg-nwp text-nwp-ink",
  derived_advisory: "bg-advisory text-advisory-ink",
  official_warning: "bg-official text-official-ink",
  location: "bg-surface-2 text-ink-2",
};

function retrievedLabel(iso: string, language: Language): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(uiLang(language) === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function WeatherCard({
  card,
  language,
}: {
  card: WeatherCardData;
  language: Language;
}) {
  const copy = t(language);
  const lang = uiLang(language);
  const icon = condition(card.conditionCode ?? null);
  const kindStyle = KIND_STYLES[card.provenance.dataKind] ?? KIND_STYLES.location;

  return (
    <section className="border-line bg-surface shadow-e1 overflow-hidden rounded-2xl border">
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-ink-3 overline truncate">{card.place}</p>
          <div className="mt-1.5 flex items-center gap-2">
            {card.conditionCode !== undefined && card.conditionCode !== null ? (
              <ConditionIcon
                icon={icon.icon}
                className="text-accent-ink h-7 w-7 shrink-0"
              />
            ) : null}
            <h3 className="text-ink text-title numeric font-semibold">{card.headline}</h3>
          </div>
          {card.subline ? (
            <p className="text-ink-2 text-caption mt-1">{card.subline}</p>
          ) : null}
        </div>
        <span
          className={`text-label shrink-0 rounded-full px-2.5 py-1 font-medium ${kindStyle}`}
        >
          {copy.kind[card.provenance.dataKind]}
        </span>
      </header>

      {card.metrics.length > 0 ? (
        <dl className="mt-4 grid grid-cols-2 [&>*]:border-line [&>*]:border-t sm:[&>*:nth-child(2n)]:border-l">
          {card.metrics.map((metric) => (
            <div key={metric.label} className="px-4 py-2.5">
              <dt className="text-ink-3 overline">{metric.label}</dt>
              <dd className="text-ink text-caption numeric mt-0.5 font-semibold">
                {metric.value}
              </dd>
              {metric.hint ? (
                <dd className="text-ink-3 text-label numeric">{metric.hint}</dd>
              ) : null}
            </div>
          ))}
        </dl>
      ) : null}

      {card.hourly && card.hourly.length > 0 ? (
        <div className="border-line border-t px-4 pt-3">
          <p className="text-ink-3 overline">{copy.hourly}</p>
          <ul className="scrollbar-slim mt-2 flex gap-2 overflow-x-auto pb-2">
            {card.hourly.map((point) => (
              <li
                key={point.time}
                className="bg-surface-2 border-line flex min-w-[64px] flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center"
              >
                <span className="text-ink-3 text-label numeric">{point.label}</span>
                <ConditionIcon
                  icon={condition(point.conditionCode).icon}
                  className="text-accent-ink h-4 w-4"
                />
                <span className="text-ink text-caption numeric font-semibold">
                  {fmtTemp(point.tempC)}
                </span>
                <span className="text-accent-ink text-label numeric">
                  {point.precipProbability === null
                    ? "—"
                    : `${Math.round(point.precipProbability)}%`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {card.daily && card.daily.length > 0 ? (
        <div className="border-line border-t px-4 pt-3">
          <p className="text-ink-3 overline">{copy.daily}</p>
          <ul className="divide-line mt-1 divide-y">
            {card.daily.map((day) => (
              <li key={day.date} className="text-caption flex items-center gap-3 py-2">
                <span className="text-ink-2 numeric w-24 shrink-0">{day.label}</span>
                <ConditionIcon
                  icon={condition(day.conditionCode).icon}
                  className="text-accent-ink h-4 w-4 shrink-0"
                />
                <span className="text-ink-3 flex-1 truncate">
                  {day.conditionCode === null || day.conditionCode === undefined
                    ? ""
                    : lang === "hi"
                      ? condition(day.conditionCode).hi
                      : condition(day.conditionCode).en}
                </span>
                <span className="text-accent-ink numeric w-12 shrink-0 text-right">
                  {day.precipProbability === null
                    ? day.precipMm === null
                      ? "—"
                      : `${day.precipMm} mm`
                    : `${Math.round(day.precipProbability)}%`}
                </span>
                <span className="text-ink numeric w-20 shrink-0 text-right font-semibold">
                  {day.maxC === null && day.minC === null
                    ? "—"
                    : `${fmtTemp(day.maxC)} / ${fmtTemp(day.minC)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="border-line bg-surface-2 text-ink-3 text-label mt-3 space-y-1 border-t px-4 py-2.5">
        <p>
          {card.provenance.source}
          {card.provenance.model ? ` · ${card.provenance.model}` : ""} · {copy.retrieved}{" "}
          <span className="numeric">{retrievedLabel(card.provenance.retrievedAt, language)}</span>
        </p>
        {card.provenance.note ? <p className="italic">{card.provenance.note}</p> : null}
      </footer>
    </section>
  );
}
