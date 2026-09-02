"use client";

import { MeterIcon, MicIcon } from "./icons";

/**
 * The VOICE switch. Hidden entirely when the browser has no speech recognition
 * rather than shown as a control that quietly does nothing.
 *
 * While listening the switch inverts and the mic glyph is replaced by a level
 * meter — three bars, the only thing in the composer that moves, and it moves
 * because something really is being recorded.
 */
export function MicButton({
  supported,
  listening,
  onToggle,
  label,
  listeningLabel,
  word,
  disabled,
}: {
  supported: boolean;
  listening: boolean;
  onToggle: () => void;
  label: string;
  listeningLabel: string;
  word: string;
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
      className="switch shrink-0"
    >
      {listening ? <MeterIcon className="h-3.5 w-3.5" /> : <MicIcon className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{word}</span>
    </button>
  );
}
