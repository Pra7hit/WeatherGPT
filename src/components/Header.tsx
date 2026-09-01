"use client";

import type { ClientLocation, Language } from "@/lib/types";
import { t } from "@/lib/uiText";

import { LanguageSelector } from "./LanguageSelector";
import { LocationSelector } from "./LocationSelector";
import { ThemeToggle } from "./ThemeToggle";
import { PlusIcon, SparkIcon } from "./icons";

export function Header({
  language,
  location,
  onLanguageChange,
  onLocationChange,
  onNewChat,
}: {
  language: Language;
  location: ClientLocation | null;
  onLanguageChange: (language: Language) => void;
  onLocationChange: (location: ClientLocation | null) => void;
  onNewChat: () => void;
}) {
  const copy = t(language);

  return (
    <header className="border-line bg-canvas relative z-20 border-b">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-4 py-2.5 sm:gap-2 sm:px-6">
        <span className="bg-accent text-on-accent shadow-e1 mr-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-xl sm:mr-0">
          <SparkIcon className="h-5 w-5" />
        </span>
        {/* Below sm the four controls need the whole row: the wordmark would be
            squeezed to a couple of pixels of ellipsis, so the mark carries the
            identity alone and the text returns as soon as there is room. */}
        <div className="hidden min-w-0 sm:mr-auto sm:block">
          <p className="text-ink text-body truncate font-semibold tracking-tight">{copy.brand}</p>
          <p className="text-ink-3 text-label truncate">{copy.tagline}</p>
        </div>

        <LocationSelector location={location} language={language} onChange={onLocationChange} />
        <LanguageSelector language={language} onChange={onLanguageChange} />
        <ThemeToggle label={copy.theme} />

        <button
          type="button"
          onClick={onNewChat}
          title={copy.newChat}
          aria-label={copy.newChat}
          className="bg-ink text-canvas hover:bg-ink-2 text-caption flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 font-medium transition-colors duration-150"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{copy.newChat}</span>
        </button>
      </div>
    </header>
  );
}
