"use client";

import { useEffect, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { Language } from "@/lib/types";
import { t } from "@/lib/uiText";

import { MicButton } from "./MicButton";
import { SendIcon, StopIcon } from "./icons";

/**
 * Message composer.
 *
 * A recognised utterance is dropped into the box rather than sent immediately -
 * speech recognition mishears place names often enough that a silent auto-send
 * would put a question the user never asked into the transcript.
 */

const MAX_HEIGHT = 180;

export function Composer({
  language,
  streaming,
  onSend,
  onStop,
}: {
  language: Language;
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const copy = t(language);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const speech = useSpeechRecognition({
    lang: language === "hi" ? "hi-IN" : "en-IN",
    onFinal: (transcript) => {
      setDraft((current) => (current ? `${current} ${transcript}` : transcript));
      textareaRef.current?.focus();
    },
  });

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_HEIGHT)}px`;
  }, [draft]);

  const submit = () => {
    const text = draft.trim();
    if (!text || streaming) return;
    setDraft("");
    onSend(text);
  };

  return (
    <div className="border-line bg-canvas border-t">
      <div className="mx-auto w-full max-w-3xl px-4 py-3 sm:px-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="border-line bg-surface shadow-e1 focus-within:border-accent-line focus-within:outline-ring flex items-end gap-2 rounded-2xl border p-2 transition-colors duration-150 focus-within:outline-2 focus-within:outline-offset-2"
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={speech.listening ? copy.micListening : copy.placeholder}
            aria-label={copy.placeholder}
            className="scrollbar-slim text-ink placeholder:text-ink-3 focus-quiet text-body max-h-[180px] flex-1 resize-none bg-transparent px-2 py-1.5 outline-none"
          />

          <MicButton
            supported={speech.supported}
            listening={speech.listening}
            onToggle={speech.toggle}
            label={copy.mic}
            listeningLabel={copy.micListening}
            disabled={streaming}
          />

          {streaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={copy.stop}
              title={copy.stop}
              className="bg-ink text-canvas hover:bg-ink-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
            >
              <StopIcon className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={draft.trim().length === 0}
              aria-label={copy.send}
              title={copy.send}
              className="bg-accent text-on-accent hover:bg-accent-hover disabled:bg-surface-3 disabled:text-ink-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:cursor-not-allowed"
            >
              <SendIcon className="h-4 w-4" />
            </button>
          )}
        </form>

        {speech.listening && speech.interim ? (
          <p className="text-ink-3 text-caption mt-1.5 px-2 italic">{speech.interim}</p>
        ) : null}
        {speech.error ? (
          <p className="text-sev-severe-ink text-caption mt-1.5 px-2">{speech.error}</p>
        ) : null}

        {/* Standing disclaimer: the model is told the same thing, but the UI says it
            unconditionally so it is on screen even when an answer forgets to. Held
            to a reading measure rather than the composer's width - at 12px the full
            container would run past 90 characters a line. */}
        <p className="text-ink-3 text-label mx-auto mt-2.5 max-w-[27rem] px-2 text-center">
          {copy.disclaimer}
        </p>
      </div>
    </div>
  );
}
