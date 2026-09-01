"use client";

import { MicIcon, SpinnerIcon } from "./icons";

/**
 * Microphone button. Hidden entirely when the browser has no speech recognition
 * rather than shown as a control that quietly does nothing.
 */
export function MicButton({
  supported,
  listening,
  onToggle,
  label,
  listeningLabel,
  disabled,
}: {
  supported: boolean;
  listening: boolean;
  onToggle: () => void;
  label: string;
  listeningLabel: string;
  disabled?: boolean;
}) {
  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? listeningLabel : label}
      title={listening ? listeningLabel : label}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:opacity-40 ${
        listening
          ? "bg-sev-severe text-sev-severe-ink"
          : "text-ink-3 hover:text-ink hover:bg-surface-2"
      }`}
    >
      {listening ? <SpinnerIcon className="h-4 w-4" /> : <MicIcon className="h-5 w-5" />}
    </button>
  );
}
