"use client";

import { useEffect, useState } from "react";

import type { ClientLocation, Language } from "@/lib/types";
import { t, uiLang } from "@/lib/uiText";

import { LanguageSelector } from "./LanguageSelector";
import { LocationSelector } from "./LocationSelector";
import { ThemeToggle } from "./ThemeToggle";
import { MarkIcon, PlusIcon } from "./icons";

/**
 * The head rule.
 *
 * Two ruled bands — identity above, the switch bank below — closed off from the
 * transcript by a 2px ink rule. There is no logotype tile and no avatar: the
 * mark is a barcode fragment, which is the only ornament this world allows,
 * because it is made of the same bars the data is drawn with.
 *
 * The clock is the device's own, in 24-hour time. It is the one number in the
 * header and it is deliberately not weather.
 */

function useClock(language: Language): string {
  const [now, setNow] = useState("");

  useEffect(() => {
    const format = new Intl.DateTimeFormat(uiLang(language) === "hi" ? "hi-IN" : "en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const tick = () => setNow(format.format(new Date()));
    tick();
    // Minutes only, so a quarter-minute tick is precise enough and the header
    // does not re-render once a second on a phone.
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [language]);

  return now;
}

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
  const clock = useClock(language);

  return (
    <header className="bg-ground border-ink relative z-20 shrink-0 border-b-2">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="flex items-baseline gap-2.5 py-1.5">
          <MarkIcon className="h-4 w-4 shrink-0 translate-y-0.5" />
          <p className="mono-label shrink-0">{copy.brand}</p>
          {/* The one sentence in the chrome, so it is the one thing here not set
              in tracked caps: a 40-character line in caps is slower to read than
              the label it would be pretending to be. */}
          <p className="text-caption hidden min-w-0 flex-1 truncate sm:block">{copy.tagline}</p>
          <span aria-hidden="true" className="border-hair flex-1 border-t sm:hidden" />
          {/* Empty until the effect runs, so the server and the client agree. */}
          <p className="mono-label numeric shrink-0">{clock}</p>
        </div>

        <div className="border-hair flex items-center gap-1.5 border-t py-2">
          <div className="min-w-0 flex-1 sm:flex-none">
            <LocationSelector location={location} language={language} onChange={onLocationChange} />
          </div>

          <span aria-hidden="true" className="border-hair hidden flex-1 border-t sm:block" />

          <LanguageSelector language={language} onChange={onLanguageChange} />
          <ThemeToggle language={language} />

          <button
            type="button"
            onClick={onNewChat}
            title={copy.newChat}
            aria-label={copy.newChat}
            className="switch shrink-0"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{copy.newChat}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
