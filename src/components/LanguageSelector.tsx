"use client";

import type { Language } from "@/lib/types";
import { t } from "@/lib/uiText";

/**
 * Language selector, as a bolted switch bank.
 *
 * "Auto" is the default and the honest one: the model replies in the language of
 * the question, including romanised Hindi. An explicit choice is only a
 * tiebreaker for the model, the chrome and the speech recogniser.
 *
 * The three switches share their rules — each one after the first pulls back a
 * pixel — so the bank reads as one bolted plate rather than three buttons.
 */

const OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "EN" },
  { value: "hi", label: "हि" },
];

/** Which segments are set in Devanagari depends on the UI language — "स्वतः" and
 *  "हि" both are — so the script is read off the rendered label rather than
 *  hard-coded against a language value. */
const DEVANAGARI = /\p{Script=Devanagari}/u;

export function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  const copy = t(language);

  return (
    <div role="group" aria-label={copy.language} className="flex shrink-0">
      {OPTIONS.map((option, index) => {
        const label = option.value === "auto" ? copy.languageAuto : option.label;
        const deva = DEVANAGARI.test(label);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={option.value === language}
            lang={deva ? "hi" : undefined}
            className={`switch min-w-[2.75rem] px-2 ${index > 0 ? "-ml-px" : ""} ${
              deva ? "deva-label" : ""
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
