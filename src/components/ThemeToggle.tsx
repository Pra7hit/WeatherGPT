"use client";

import { useState } from "react";

import { useTheme } from "@/hooks/useTheme";
import type { Language } from "@/lib/types";
import { t } from "@/lib/uiText";

import { InvertIcon } from "./icons";

/**
 * The theme control — INVERT.
 *
 * In this world dark mode is not a second palette, it is the inversion, so the
 * control says what it does. One sheet of ink wipes across the frame in 300ms
 * and the field comes back the other way round: a single pass per press, well
 * under the three-flash threshold, and never on a timer.
 *
 * Under `prefers-reduced-motion` the global duration override collapses the
 * wipe, `animationend` fires immediately, and the overlay unmounts having shown
 * nothing — the theme still flips.
 */
export function ThemeToggle({ language }: { language: Language }) {
  const copy = t(language);
  const { theme, ready, toggle } = useTheme();
  const [wipe, setWipe] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setWipe((count) => count + 1);
          toggle();
        }}
        // Before the effect in useTheme runs the real theme is unknown, so the
        // switch reports no pressed state rather than guessing at one.
        aria-pressed={ready ? theme === "dark" : undefined}
        aria-label={copy.theme}
        title={copy.theme}
        className="switch shrink-0"
      >
        <InvertIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{copy.invert}</span>
      </button>

      {wipe > 0 ? (
        <div
          key={wipe}
          aria-hidden="true"
          onAnimationEnd={() => setWipe(0)}
          className="animate-wipe bg-ink pointer-events-none fixed inset-0 z-50"
        />
      ) : null}
    </>
  );
}
