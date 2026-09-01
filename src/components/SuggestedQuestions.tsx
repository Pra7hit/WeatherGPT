"use client";

import type { Language } from "@/lib/types";
import { SUGGESTIONS, t, uiLang } from "@/lib/uiText";

import { ArrowIcon, SparkIcon } from "./icons";

/**
 * Empty state. The suggestions are the demo questions themselves, in the
 * chrome's language, so the first thing a new user sees is what the assistant
 * can actually be asked.
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
    <div className="mx-auto max-w-2xl px-1 py-10 sm:py-14">
      <div className="text-center">
        {/* The icon sits in the heading's own text flow rather than in a tile
            stacked above it, so it scales and wraps with the words. */}
        <h2 className="text-ink text-display font-semibold">
          <SparkIcon className="text-accent-ink mr-2 inline-block h-[1.05em] w-[1.05em] align-[-0.14em]" />
          {copy.emptyTitle}
        </h2>
        <p className="text-ink-2 text-body mx-auto mt-2.5 max-w-[52ch]">{copy.emptyBody}</p>
      </div>

      <p className="text-ink-3 overline mt-9 text-center">{copy.suggestions}</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {questions.map((question) => (
          <li key={question}>
            <button
              type="button"
              onClick={() => onPick(question)}
              className="group border-line bg-surface text-ink-2 shadow-e1 hover:border-accent-line hover:bg-accent-soft hover:text-accent-ink text-caption flex h-full w-full items-start gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-150"
            >
              <span className="flex-1">{question}</span>
              <ArrowIcon className="text-ink-3 group-hover:text-accent-ink mt-0.5 h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
