"use client";

import { MeterIcon, MicIcon } from "./icons";

/**
 * The VOICE switch. Hidden entirely when the browser has no speech recognition
 * rather than shown as a control that quietly does nothing.
 *
 * Three states on one switch, and the ink tells them apart. Off is the mic
 * glyph on ground. While listening the switch inverts and the glyph becomes a
 * level meter — three bars, the only thing in the composer that moves, and it
 * moves because something really is being recorded.
 *
 * `preparing` is the third: a language pack is downloading and nothing is being
 * recorded yet, so the meter runs but the switch stays un-inverted. The motion
 * says working, the un-inverted ink says not hearing you. Both busy states
 * cancel on click, and the word never changes — it names the control, not what
 * the control is currently doing.
 */
export function MicButton({
  supported,
  listening,
  preparing,
  onToggle,
  label,
  listeningLabel,
  preparingLabel,
  word,
  disabled,
}: {
  supported: boolean;
  listening: boolean;
  preparing?: boolean;
  onToggle: () => void;
  label: string;
  listeningLabel: string;
  preparingLabel?: string;
  word: string;
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
      /* Only `listening` presses the switch: inversion is the claim that audio
         is being captured, and during a pack download that would be a lie. */
      aria-pressed={listening}
      aria-busy={preparing ? true : undefined}
      aria-label={title}
      title={title}
      className="switch shrink-0"
    >
      {busy ? <MeterIcon className="h-3.5 w-3.5" /> : <MicIcon className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{word}</span>
    </button>
  );
}
