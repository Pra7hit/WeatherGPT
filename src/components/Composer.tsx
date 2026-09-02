"use client";

import { useEffect, useRef, useState } from "react";

import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import type { Language } from "@/lib/types";
import { t } from "@/lib/uiText";

import { MicButton } from "./MicButton";
import { SendIcon, StopIcon } from "./icons";

/**
 * The composer, docked on a 2px ink rule.
 *
 * A recognised utterance is dropped into the box rather than sent immediately —
 * speech recognition mishears place names often enough that a silent auto-send
 * would put a question the user never asked into the transcript.
 *
 * The question is typed on a ruled baseline that goes to full ink on focus, and
 * SEND is the darkest thing on the page the moment there is anything to send: it
 * fills with ink as the first character lands, and inverts the other way under
 * the pointer. With an empty box it is a hollow switch on a hairline — no word is
 * ever thinned to mean "not yet".
 */

const MAX_HEIGHT = 180;

/* The action sits on the same switch grammar as the rest of the chrome, so SEND
   and VOICE are the same object at different states rather than two shapes. */
const ACTION = "switch shrink-0";

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

  const armed = draft.trim().length > 0;

  return (
    <div className="bg-ground border-ink shrink-0 border-t-2">
      <div className="mx-auto w-full max-w-3xl px-4 py-2.5 sm:px-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex flex-col gap-2.5"
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
            /* The placeholder is full ink in the machine's mono — no thinned ink
               anywhere, and the face alone tells the field's own prompt apart
               from the sans the answer is typed in. */
            className="scrollbar-hair border-hair-3 focus:border-ink text-body prompt-hint max-h-[180px] w-full resize-none border-b bg-transparent py-1 outline-none transition-colors duration-100"
          />

          <div className="flex items-center justify-end gap-1.5">
            <div aria-live="polite" className="mr-auto min-w-0 flex-1">
              {speech.listening && speech.interim ? (
                <p className="numeric text-caption truncate">{speech.interim}</p>
              ) : speech.notice ? (
                /* Voice progress — switching to the on-device engine, fetching its
                   language pack — shares the caption register with the transcript
                   and the terminal message, because this slot has no colour to
                   grade them with. What keeps them apart is that only one is ever
                   set: the hook clears the notice the moment it either succeeds or
                   gives up, and it is bounded, so it cannot sit here forever. */
                <p className="numeric text-caption">{speech.notice}</p>
              ) : speech.error ? (
                <p className="numeric text-caption">{speech.error}</p>
              ) : null}
            </div>

            <MicButton
              supported={speech.supported}
              listening={speech.listening}
              preparing={speech.preparing}
              onToggle={speech.toggle}
              label={copy.mic}
              listeningLabel={copy.micListening}
              preparingLabel={copy.micPreparing}
              word={copy.voice}
              disabled={streaming}
            />

            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                aria-label={copy.stop}
                title={copy.stop}
                data-action="true"
                data-on="true"
                className={ACTION}
              >
                <StopIcon className="h-3.5 w-3.5" />
                <span>{copy.stop}</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!armed}
                aria-label={copy.send}
                title={copy.send}
                data-action="true"
                data-on={armed ? "true" : undefined}
                className={ACTION}
              >
                <SendIcon className="h-3.5 w-3.5" />
                <span>{copy.send}</span>
              </button>
            )}
          </div>
        </form>

        {/* Standing disclaimer: the model is told the same thing, but the UI says
            it unconditionally so it is on screen even when an answer forgets to. */}
        <p className="numeric text-caption mt-2.5 max-w-[72ch]">{copy.disclaimer}</p>
      </div>
    </div>
  );
}
