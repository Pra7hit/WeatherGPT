"use client";

import type { AlertCardData, AlertSeverity, Language } from "@/lib/types";
import { dateTimeLabel } from "@/lib/time";
import { t, uiLang } from "@/lib/uiText";

import { AlertIcon, InfoIcon } from "./icons";

/**
 * The alert plate.
 *
 * The split is the product rule, not a style choice: a plate headed "Official
 * warning — <authority>" is only ever rendered for a warning an authority
 * actually issued, and a forecast-derived advisory gets a dashed outline that is
 * never filled and says in words that it is not an official warning. Nothing in
 * the UI can promote one into the other, because `official` is set by the server
 * that fetched it.
 *
 * With no colour to spend, the five official severities are told apart by rising
 * ink coverage — hairline, bars, dither, solid, then the whole plate inverted —
 * and the step is always printed as a word and a five-block meter beside it, so
 * the coverage is never the only signal. An advisory never borrows that ramp.
 */

type Ramp = {
  shell: string;
  /** The coverage strip across the head of the plate: the ramp itself. */
  strip: string | null;
  rule: string;
  meterOn: string;
  meterOff: string;
};

const STEPS: AlertSeverity[] = ["info", "minor", "moderate", "severe", "extreme"];

const NEUTRAL = { rule: "border-hair-2", meterOn: "bg-ink", meterOff: "border border-hair-3" };

/* Border weights come off the seed: 1px, 2px, then the loud 3px. Only `extreme`
   inverts, and it is the only inverted surface anywhere in the product. */
const OFFICIAL: Record<AlertSeverity, Ramp> = {
  info: { shell: "border border-hair-3", strip: "bg-hair", ...NEUTRAL },
  minor: { shell: "border border-ink", strip: "field-bars", ...NEUTRAL },
  moderate: { shell: "border-2 border-ink", strip: "field-dither", ...NEUTRAL },
  severe: { shell: "border-[3px] border-ink", strip: "bg-ink", ...NEUTRAL },
  extreme: {
    shell: "border-[3px] border-ink bg-ink text-ground",
    strip: null,
    rule: "border-ground/40",
    meterOn: "bg-ground",
    meterOff: "border border-ground/50",
  },
};

const ADVISORY: Ramp = { shell: "border border-dashed border-ink", strip: null, ...NEUTRAL };

const SEVERITY_LABEL: Record<AlertSeverity, { en: string; hi: string }> = {
  extreme: { en: "Extreme", hi: "अत्यधिक" },
  severe: { en: "Severe", hi: "गंभीर" },
  moderate: { en: "Moderate", hi: "मध्यम" },
  minor: { en: "Minor", hi: "हल्का" },
  info: { en: "Information", hi: "सूचना" },
};

/** Five blocks, filled to the step. Decorative — the step is printed beside it. */
function SeverityMeter({ level, on, off }: { level: AlertSeverity; on: string; off: string }) {
  const filled = STEPS.indexOf(level) + 1;
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-[2px]">
      {STEPS.map((step, index) => (
        <span key={step} className={`h-2.5 w-1.5 ${index < filled ? on : off}`} />
      ))}
    </span>
  );
}

export function AlertCard({ alert, language }: { alert: AlertCardData; language: Language }) {
  const copy = t(language);
  const lang = uiLang(language);
  const severity = SEVERITY_LABEL[alert.severity][lang];
  const ramp = alert.official ? OFFICIAL[alert.severity] : ADVISORY;

  return (
    <section className={`mt-4 ${ramp.shell}`}>
      {ramp.strip ? <span aria-hidden="true" className={`block h-1.5 ${ramp.strip}`} /> : null}

      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-px shrink-0">
            {alert.official ? <AlertIcon className="h-4 w-4" /> : <InfoIcon className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="mono-label">
              {alert.official
                ? `${copy.official}${alert.authority ? ` — ${alert.authority}` : ""}`
                : copy.advisory}
            </p>
            <h3 className="text-title mt-1 font-semibold">{alert.event}</h3>
            <p className="numeric text-caption mt-0.5">
              {alert.place}
              {alert.starts ? ` · ${dateTimeLabel(alert.starts, lang)}` : ""}
              {alert.ends ? ` → ${dateTimeLabel(alert.ends, lang)}` : ""}
            </p>
          </div>
        </div>

        <div className={`mt-2.5 flex items-center gap-2 border-t pt-2 ${ramp.rule}`}>
          <span className="mono-label shrink-0">{copy.severity}</span>
          <SeverityMeter level={alert.severity} on={ramp.meterOn} off={ramp.meterOff} />
          <span className="mono-label">{severity}</span>
        </div>

        <p className="text-body mt-2.5 max-w-[68ch] whitespace-pre-wrap">{alert.description}</p>

        {alert.evidence && alert.evidence.length > 0 ? (
          <div className={`mt-2.5 border-t pt-2 ${ramp.rule}`}>
            <p className="mono-label">{copy.evidence}</p>
            <ul className="mt-1.5 space-y-1">
              {alert.evidence.map((line) => (
                <li key={line} className="numeric text-caption flex gap-2">
                  <span aria-hidden="true" className="mt-[0.5em] h-1.5 w-1.5 shrink-0 bg-current" />
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!alert.official ? (
          <p className="mono-label mt-2.5 border border-dashed border-current px-2 py-1.5">
            {copy.notOfficial}
          </p>
        ) : null}

        <footer className={`mt-2.5 border-t pt-1.5 ${ramp.rule}`}>
          <p className="mono-label">
            {alert.provenance.source} · {copy.kind[alert.provenance.dataKind]}
          </p>
          {alert.provenance.note ? (
            <p className="numeric text-caption mt-1">{alert.provenance.note}</p>
          ) : null}
        </footer>
      </div>
    </section>
  );
}
