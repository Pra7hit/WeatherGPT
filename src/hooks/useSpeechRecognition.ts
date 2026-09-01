"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Voice input over the browser's Web Speech API.
 *
 * There is no polyfill and no cloud STT here: if the browser does not implement
 * `SpeechRecognition` (Firefox today) the hook reports `supported: false` and the
 * mic button hides itself rather than pretending to listen. Recognition is
 * single-utterance - it stops on its own when the user stops talking, which is
 * what a chat composer wants.
 *
 * The Web Speech types are not in lib.dom for every TS version, so the small
 * surface actually used is declared locally.
 */

interface SpeechAlternativeLike {
  transcript: string;
}

interface SpeechResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechAlternativeLike;
}

interface SpeechResultListLike {
  readonly length: number;
  [index: number]: SpeechResultLike;
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: SpeechResultListLike;
}

interface SpeechErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission was declined.",
  "service-not-allowed": "Microphone permission was declined.",
  "no-speech": "I did not catch anything. Try again.",
  "audio-capture": "No microphone was found.",
  network: "The speech service could not be reached.",
};

export interface SpeechRecognitionOptions {
  /** BCP-47 tag, e.g. "en-IN" or "hi-IN". */
  lang: string;
  /** Called with the final transcript once the utterance ends. */
  onFinal: (transcript: string) => void;
}

/** Support is a fixed property of the browser, so it never needs a subscription. */
const NEVER_CHANGES = () => () => {};

function readSupported(): boolean {
  return getConstructor() !== null;
}

function serverSupported(): boolean {
  return false;
}

export function useSpeechRecognition({ lang, onFinal }: SpeechRecognitionOptions) {
  const supported = useSyncExternalStore(NEVER_CHANGES, readSupported, serverSupported);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // The callback is read from a ref so a new `onFinal` identity does not tear
  // down a recognition session that is already listening.
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) return;

    recognitionRef.current?.abort();
    setError(null);
    setInterim("");

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText.trim()) {
        setInterim("");
        finalRef.current(finalText.trim());
      }
    };

    recognition.onerror = (event) => {
      setError(ERRORS[event.error] ?? "Voice input failed. Please type instead.");
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setError("Voice input could not start. Please type instead.");
      setListening(false);
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
