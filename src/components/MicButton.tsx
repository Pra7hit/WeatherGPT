"use client";

import { MicIcon, SpinnerIcon } from "./icons";

/**
 * Microphone button. Hidden entirely when the browser has no speech recognition
 * rather than shown as a control that quietly does nothing.
 *
 * `preparing` is a third state, kept apart from `listening` on purpose: a
 * language pack is downloading and nothing is being recorded yet, so the button
 * spins but does not claim to be hearing anything. Both states cancel on click.
 */
export function MicButton({
  supported,
  listening,
  preparing,
  onToggle,
  label,
  listeningLabel,
  preparingLabel,
  disabled,
}: {
  supported: boolean;
  listening: boolean;
  preparing?: boolean;
  onToggle: () => void;
  label: string;
  listeningLabel: string;
  preparingLabel?: string;
  disabled?: boolean;
}) {
  if (!supported) return null;

  const busy = listening || Boolean(preparing);
  const title = listening ? listeningLabel : preparing ? (preparingLabel ?? label) : label;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-busy={preparing ? true : undefined}
      aria-label={title}
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-40 ${
        listening
          ? "bg-sev-severe text-sev-severe-ink"
          : preparing
            ? "bg-surface-2 text-ink-2"
            : "text-ink-3 hover:text-ink hover:bg-surface-2"
      }`}
    >
      {busy ? <SpinnerIcon className="h-4 w-4" /> : <MicIcon className="h-5 w-5" />}
    </button>
  );
}
