"use client";

import type { Language } from "@/lib/types";
import { t } from "@/lib/uiText";

/**
 * Language selector.
 *
 * "Auto" is the default and the honest one: the model replies in the language of
 * the question, including romanised Hindi. An explicit choice is only a
 * tiebreaker for the model and the language chrome and speech recogniser use.
 */

const OPTIONS: Array<{ value: Language; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "en", label: "EN" },
  { value: "hi", label: "हि" },
];

export function LanguageSelector({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  const copy = t(language);

  return (
    <div
      role="group"
      aria-label={copy.language}
      className="bg-surface-2 flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = option.value === language;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={`text-caption rounded-md px-2 py-1 font-medium transition-colors duration-150 ${
              active
                ? "bg-raised text-ink shadow-e1"
                : "text-ink-3 hover:text-ink hover:bg-surface-3"
            }`}
          >
            {option.value === "auto" ? copy.languageAuto : option.label}
          </button>
        );
      })}
    </div>
  );
}
