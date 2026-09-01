"use client";

import type { AlertCardData, AlertSeverity, Language } from "@/lib/types";
import { dateTimeLabel } from "@/lib/time";
import { t, uiLang } from "@/lib/uiText";

import { AlertIcon, InfoIcon } from "./icons";

/**
 * Alert card.
 *
 * The visual split is the point: a card carrying the severity ramp and headed
 * "Official warning - <authority>" is only ever rendered for a warning issued by
 * a meteorological authority, and a forecast-derived advisory gets a neutral card
 * that says in words that it is not an official warning, plus the numbers that
 * tripped its threshold. Nothing in the UI can promote one into the other,
 * because `official` is set by the server that fetched it.
 *
 * Within the official ramp the five severities have to be told apart in a hurry
 * and possibly in sunlight, so loudness rises step by step and `extreme` is the
 * only filled card anywhere in the product. On that filled surface every
 * secondary text tone is the card's own foreground at reduced opacity - gray
 * text on a coloured ground goes muddy and unreadable.
 */

type Tone = {
  shell: string;
  icon: string;
  kicker: string;
  heading: string;
  body: string;
  meta: string;
  chip: string;
  rule: string;
  inset: string;
};

const OFFICIAL_TONES: Record<AlertSeverity, Tone> = {
  extreme: {
    shell: "bg-sev-extreme border-sev-extreme-line shadow-e2",
    icon: "text-sev-extreme-ink",
    kicker: "text-sev-extreme-ink",
    heading: "text-sev-extreme-ink",
    body: "text-sev-extreme-ink/90",
    meta: "text-sev-extreme-ink/75",
    chip: "bg-sev-extreme-ink text-sev-extreme",
    rule: "border-sev-extreme-ink/25",
    inset: "bg-sev-extreme-ink/10 text-sev-extreme-ink/90",
  },
  severe: {
    shell: "bg-sev-severe border-sev-severe-line shadow-e1",
    icon: "text-sev-severe-ink",
    kicker: "text-sev-severe-ink",
    heading: "text-ink",
    body: "text-ink",
    meta: "text-sev-severe-ink",
    chip: "bg-sev-severe-ink text-sev-severe",
    rule: "border-sev-severe-line",
    inset: "bg-sev-severe-ink/10 text-sev-severe-ink",
  },
  moderate: {
    shell: "bg-sev-moderate border-sev-moderate-line shadow-e1",
    icon: "text-sev-moderate-ink",
    kicker: "text-sev-moderate-ink",
    heading: "text-ink",
    body: "text-ink",
    meta: "text-sev-moderate-ink",
    chip: "bg-sev-moderate-ink/15 text-sev-moderate-ink",
    rule: "border-sev-moderate-line",
    inset: "bg-sev-moderate-ink/10 text-sev-moderate-ink",
  },
  minor: {
    shell: "bg-surface border-sev-minor-line shadow-e1",
    icon: "text-sev-minor-ink",
    kicker: "text-sev-minor-ink",
    heading: "text-ink",
    body: "text-ink-2",
    meta: "text-ink-3",
    chip: "bg-sev-minor-ink/12 text-sev-minor-ink",
    rule: "border-line",
    inset: "bg-surface-2 text-ink-2",
  },
  info: {
    shell: "bg-surface border-line shadow-e1",
    icon: "text-ink-3",
    kicker: "text-ink-3",
    heading: "text-ink",
    body: "text-ink-2",
    meta: "text-ink-3",
    chip: "bg-surface-2 text-ink-2",
    rule: "border-line",
    inset: "bg-surface-2 text-ink-2",
  },
};

/**
 * A forecast-derived advisory never borrows the official ramp - that is a product
 * rule, not a style preference - so it stays on the neutral card surface and lets
 * the severity chip alone carry how serious the threshold crossing was.
 */
const ADVISORY_TONE: Tone = {
  shell: "bg-surface border-line shadow-e1",
  icon: "text-ink-3",
  kicker: "text-ink-3",
  heading: "text-ink",
  body: "text-ink-2",
  meta: "text-ink-3",
  chip: "bg-surface-2 text-ink-2 border-line border",
  rule: "border-line",
  inset: "bg-surface-2 text-ink-2",
};

const SEVERITY_LABEL: Record<AlertSeverity, { en: string; hi: string }> = {
  extreme: { en: "Extreme", hi: "अत्यधिक" },
  severe: { en: "Severe", hi: "गंभीर" },
  moderate: { en: "Moderate", hi: "मध्यम" },
  minor: { en: "Minor", hi: "हल्का" },
  info: { en: "Information", hi: "सूचना" },
};

export function AlertCard({ alert, language }: { alert: AlertCardData; language: Language }) {
  const copy = t(language);
  const lang = uiLang(language);
  const severity = SEVERITY_LABEL[alert.severity][lang];
  const tone = alert.official ? OFFICIAL_TONES[alert.severity] : ADVISORY_TONE;

  return (
    <section className={`rounded-2xl border p-4 ${tone.shell}`}>
      <header className="flex items-start gap-3">
        <span className={`mt-0.5 shrink-0 ${tone.icon}`}>
          {alert.official ? <AlertIcon /> : <InfoIcon />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className={`overline ${tone.kicker}`}>
              {alert.official
                ? `${copy.official}${alert.authority ? ` — ${alert.authority}` : ""}`
                : copy.advisory}
            </p>
            <span className={`text-label rounded-full px-2 py-0.5 font-semibold ${tone.chip}`}>
              {severity}
            </span>
          </div>
          <h3 className={`text-title mt-1 font-semibold ${tone.heading}`}>{alert.event}</h3>
          <p className={`text-caption numeric mt-0.5 ${tone.meta}`}>
            {alert.place}
            {alert.starts ? ` · ${dateTimeLabel(alert.starts, lang)}` : ""}
            {alert.ends ? ` → ${dateTimeLabel(alert.ends, lang)}` : ""}
          </p>
        </div>
      </header>

      <p className={`text-body mt-3 max-w-[68ch] whitespace-pre-wrap ${tone.body}`}>
        {alert.description}
      </p>

      {alert.evidence && alert.evidence.length > 0 ? (
        <div className="mt-3">
          <p className={`overline ${tone.meta}`}>{copy.evidence}</p>
          <ul
            className={`text-caption numeric marker:opacity-50 mt-1.5 list-disc space-y-1 pl-5 ${tone.body}`}
          >
            {alert.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {!alert.official ? (
        <p className={`text-label mt-3 rounded-lg px-2.5 py-1.5 font-semibold ${tone.inset}`}>
          {copy.notOfficial}
        </p>
      ) : null}

      <footer className={`text-label mt-3 space-y-1 border-t pt-2.5 ${tone.rule} ${tone.meta}`}>
        <p>
          {alert.provenance.source} · {copy.kind[alert.provenance.dataKind]}
        </p>
        {alert.provenance.note ? <p className="italic">{alert.provenance.note}</p> : null}
      </footer>
    </section>
  );
}
