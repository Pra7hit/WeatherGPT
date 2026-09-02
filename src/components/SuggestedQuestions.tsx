"use client";

import type { Language } from "@/lib/types";
import { SUGGESTIONS, t, uiLang } from "@/lib/uiText";

import { ArrowIcon } from "./icons";

/**
 * The empty state.
 *
 * The heading speaks first, then the instrument answers for itself: an empty
 * ruler, ruled top and bottom, with no series drawn into it and FIELD EMPTY
 * captioned beneath. Nothing is faked to fill the space — there is no sample
 * forecast and no seeded chart, because a plausible-looking plot with no fetch
 * behind it is the one thing this product must never draw.
 *
 * The suggestions are the demo questions themselves, in the chrome's language,
 * so the first thing a new user sees is what can actually be asked.
 */
export function SuggestedQuestions({
  language,
  onPick,
}: {
  language: Language;
  onPick: (question: string) => void;
}) {
  const copy = t(language);
  const questions = SUGGESTIONS[uiLang(language)];

  return (
    <div className="py-5 sm:py-9">
      <h2 className="text-display max-w-[24ch] font-semibold">{copy.emptyTitle}</h2>
      <p className="text-body mt-3 max-w-[54ch]">{copy.emptyBody}</p>

      {/* The instrument's own answer to having nothing to show, captioned like any
          other plate in this product: the ruler, then what it is reading. */}
      <figure className="mt-7">
        <span aria-hidden="true" className="lattice border-ink block h-8 border-y-2" />
        <figcaption className="mono-label mt-1.5 flex items-baseline gap-2">
          <span className="shrink-0">{copy.fieldEmpty}</span>
          <span aria-hidden="true" className="border-hair flex-1 border-t" />
        </figcaption>
      </figure>

      <p className="mono-label mt-7">{copy.suggestions}</p>
      <ul className="mt-1.5">
        {questions.map((question, index) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="group border-hair hover:bg-ink hover:text-ground flex w-full items-baseline gap-3 border-t px-1.5 py-3 text-left transition-colors duration-100"
            >
              <span className="mono-label shrink-0">{String(index + 1).padStart(2, "0")}</span>
              <span className="text-caption min-w-0 flex-1">{question}</span>
              <ArrowIcon className="h-3.5 w-3.5 shrink-0 translate-y-0.5 transition-transform duration-150 group-hover:translate-x-1" />
            </button>
          </li>
        ))}
      </ul>
      <span aria-hidden="true" className="border-hair block border-t" />
    </div>
  );
}
