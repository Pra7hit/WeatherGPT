"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Voice input over the browser's Web Speech API, local engine first.
 *
 * One interface, two engines. The default one streams the microphone to the
 * browser vendor's servers, so it fails with `network` whenever that service is
 * out of reach — a VPN or proxy in the path, a Chromium build shipped without a
 * Google speech key (Brave), a firewall, or simply no connectivity. Retrying the
 * same route does not fix any of those. Chrome 139 added the other engine: with
 * an installed language pack and `processLocally = true`, recognition runs on the
 * machine and never opens a socket, which is the only real cure for `network`.
 *
 * So this hook prefers the local engine when a pack is already installed, uses
 * the cloud engine otherwise, and on a `network` failure installs the pack and
 * retries locally before giving up. An error reaches the user only once both
 * engines have refused, and it names the likely cause instead of saying the
 * service "could not be reached" — the same rule the rest of the app follows for
 * weather data: report what actually happened.
 *
 * If the browser has no `SpeechRecognition` at all (Firefox today) `supported` is
 * false and the mic button hides itself rather than pretending to listen.
 * Recognition stays single-utterance: it ends when the user stops talking, which
 * is what a chat composer wants.
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
  message?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  /** Chrome 139+. Forces on-device recognition; absent on older engines. */
  processLocally?: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: ((event: SpeechErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

/** `SpeechRecognition.available()` resolves to one of these four strings. */
type Availability = "unavailable" | "downloadable" | "downloading" | "available";

interface AvailabilityQuery {
  langs: string[];
  processLocally?: boolean;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
  /** Both statics are Chrome 139+, so both are optional here. */
  available?: (query: AvailabilityQuery) => Promise<Availability>;
  install?: (query: AvailabilityQuery) => Promise<boolean>;
}

/** Which engine a session was started on. `network` can only come from "cloud". */
type Engine = "local" | "cloud";

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  // Chrome exposes both names and only the unprefixed one carries the on-device
  // statics, so it has to be tried first.
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

/**
 * Voice copy stays here rather than in `uiText.ts` because it is keyed by the
 * BCP-47 tag the hook already receives, not by the app's `Language`, and because
 * this is where the error codes it explains are handled.
 */
const TEXT = {
  en: {
    permission: "Microphone permission was declined.",
    noSpeech: "I did not catch anything. Try again.",
    noMic: "No microphone was found.",
    langUnsupported: "Voice input is not available for this language.",
    cannotStart: "Voice input could not start. Please type instead.",
    generic: "Voice input failed. Please type instead.",
    insecure: "Voice input needs an https:// or localhost address.",
    offline: "No internet connection, and no offline voice pack is installed.",
    blockedByBrowser: "This browser blocks the speech service. Try Chrome, or type instead.",
    unreachable:
      "The speech service is unreachable — a VPN, proxy or firewall may be blocking it. Chrome 139+ can listen offline; otherwise please type.",
    packFailed:
      "The offline voice pack could not be downloaded and the speech service is unreachable. Please type instead.",
    packFailedBrave:
      "This browser cannot reach the speech service, and the offline voice pack would not download. Chrome can listen offline — otherwise please type.",
    switching: "Speech service unreachable — switching to offline voice…",
    preparing: "Preparing offline voice (one-time download) — tap VOICE to cancel.",
    downloading: "Downloading the offline voice pack — tap VOICE to cancel.",
    retrying: "Retrying…",
  },
  hi: {
    permission: "माइक्रोफ़ोन की अनुमति नहीं मिली।",
    noSpeech: "कुछ सुनाई नहीं दिया। फिर बोलें।",
    noMic: "कोई माइक्रोफ़ोन नहीं मिला।",
    langUnsupported: "इस भाषा में वॉइस इनपुट उपलब्ध नहीं है।",
    cannotStart: "वॉइस इनपुट शुरू नहीं हो सका। कृपया टाइप करें।",
    generic: "वॉइस इनपुट नहीं चल सका। कृपया टाइप करें।",
    insecure: "वॉइस इनपुट के लिए https:// या localhost पता ज़रूरी है।",
    offline: "इंटरनेट नहीं है, और ऑफ़लाइन वॉइस पैक भी इंस्टॉल नहीं है।",
    blockedByBrowser: "यह ब्राउज़र स्पीच सेवा रोकता है। Chrome आज़माएँ, या टाइप करें।",
    unreachable:
      "स्पीच सेवा तक नहीं पहुँच पाए — VPN, प्रॉक्सी या फ़ायरवॉल रोक रहा हो सकता है। Chrome 139+ ऑफ़लाइन सुन सकता है; वरना कृपया टाइप करें।",
    packFailed:
      "ऑफ़लाइन वॉइस पैक डाउनलोड नहीं हो सका और स्पीच सेवा भी नहीं मिली। कृपया टाइप करें।",
    packFailedBrave:
      "यह ब्राउज़र स्पीच सेवा तक नहीं पहुँच सकता, और ऑफ़लाइन वॉइस पैक भी डाउनलोड नहीं हुआ। Chrome ऑफ़लाइन सुन सकता है — वरना कृपया टाइप करें।",
    switching: "स्पीच सेवा नहीं मिली — ऑफ़लाइन वॉइस पर जा रहे हैं…",
    preparing: "ऑफ़लाइन वॉइस तैयार हो रही है (एक बार डाउनलोड) — रोकने के लिए VOICE दबाएँ।",
    downloading: "ऑफ़लाइन वॉइस पैक डाउनलोड हो रहा है — रोकने के लिए VOICE दबाएँ।",
    retrying: "फिर कोशिश कर रहे हैं…",
  },
} as const;

/** Hindi for `hi`/`hi-IN`, English for everything else the app can send. */
function textFor(lang: string) {
  return lang.toLowerCase().startsWith("hi") ? TEXT.hi : TEXT.en;
}

/** How often the pack install is checked on for signs of life. */
const POLL_MS = 1500;
/** How long a pack install may show no progress at all before we walk away. */
const STALL_MS = 12_000;
/** Hard ceiling on an install, however healthy it looks. */
const MAX_PREPARE_MS = 90_000;

/** A rejection handler for probes whose failure is already covered elsewhere. */
const noop = () => {};

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
  /** Transient progress, not a failure: shown in the same slot, styled the same. */
  const [notice, setNotice] = useState<string | null>(null);
  /** True while a language pack is installing — nothing is being recorded yet. */
  const [preparing, setPreparing] = useState(false);

  const copy = textFor(lang);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  /**
   * Bumped on every start, retry and teardown. Handlers of an abandoned session
   * compare against it and return, so a session we walked away from can never
   * write state over the one that replaced it.
   */
  const epochRef = useRef(0);
  /** Result of the on-device probe; null until it resolves. */
  const localRef = useRef<Availability | null>(null);
  /** Brave never reaches Google's speech service, and it is worth saying so. */
  const braveRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  /** Interval that watches a pack install for progress. */
  const watchdogRef = useRef<number | null>(null);
  /** Mirrors `preparing` for the callbacks that must not depend on a render. */
  const preparingRef = useRef(false);
  /** Set once a pack install has been given up on, so the message can say so. */
  const packFailedRef = useRef(false);
  /** One cloud retry per user-initiated session, not per error. */
  const retriedRef = useRef(false);

  // The callback is read from a ref so a new `onFinal` identity does not tear
  // down a recognition session that is already listening.
  const finalRef = useRef(onFinal);
  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  /** Set below; held in a ref so the error handler can restart a session. */
  const launchRef = useRef<(engine: Engine) => void>(() => {});

  // Probe the on-device engine once per language. `available()` only asks a
  // question — it downloads nothing — so it is safe to run without a gesture.
  useEffect(() => {
    let cancelled = false;
    const Ctor = getConstructor();
    if (Ctor?.available) {
      Ctor.available({ langs: [lang], processLocally: true })
        .then((status) => {
          if (!cancelled) localRef.current = status;
        })
        .catch(() => {
          if (!cancelled) localRef.current = "unavailable";
        });
    } else {
      localRef.current = "unavailable";
    }

    const nav = navigator as Navigator & { brave?: { isBrave?: () => Promise<boolean> } };
    nav.brave
      ?.isBrave?.()
      .then((yes) => {
        if (!cancelled) braveRef.current = yes;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [lang]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (watchdogRef.current !== null) {
      window.clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      epochRef.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (watchdogRef.current !== null) window.clearInterval(watchdogRef.current);
      recognitionRef.current?.abort();
    },
    [],
  );

  /**
   * Why the cloud engine could not be reached, in the order the causes can be
   * established: a page served over plain http on a LAN address and an offline
   * machine are certainties, a failed pack download is a certainty about the one
   * escape route, Brave is a certainty about this browser, and the rest is the
   * honest "something in the path is blocking it".
   */
  const diagnose = useCallback(() => {
    if (typeof window !== "undefined" && !window.isSecureContext) return copy.insecure;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return copy.offline;
    if (packFailedRef.current) {
      return braveRef.current ? copy.packFailedBrave : copy.packFailed;
    }
    if (braveRef.current) return copy.blockedByBrowser;
    return copy.unreachable;
  }, [copy]);

  const fail = useCallback((message: string) => {
    setError(message);
    setNotice(null);
    setInterim("");
    setListening(false);
    preparingRef.current = false;
    setPreparing(false);
  }, []);

  /** True when the local engine is installed or still installable. */
  const canGoLocal = useCallback(() => {
    const Ctor = getConstructor();
    // Chrome ships the two statics together; requiring both keeps the install
    // path below from having to cope with half an API.
    if (!Ctor?.available || !Ctor.install) return false;
    const status = localRef.current;
    return status === "available" || status === "downloadable" || status === "downloading";
  }, []);

  /**
   * One deferred cloud attempt per user-initiated session, shared by every code
   * that wants to fall back to it. Returns false once that budget is spent, so a
   * caller knows to give up rather than loop. The short delay matters: Chrome
   * reports `network` again if a session opens while the last one is still
   * tearing down, which is exactly how a single flake becomes a permanent one.
   */
  const deferCloudAttempt = useCallback(() => {
    if (retriedRef.current) return false;
    retriedRef.current = true;
    setNotice(copy.retrying);
    setInterim("");
    setListening(false);
    preparingRef.current = false;
    setPreparing(false);
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      launchRef.current("cloud");
    }, 400);
    return true;
  }, [clearTimer, copy]);

  /**
   * Stop counting on the local engine for the rest of this page's life and take
   * whatever is left: one cloud attempt if the budget is unspent, otherwise an
   * error that says the pack could not be fetched rather than blaming the
   * network alone.
   */
  const abandonLocal = useCallback(() => {
    localRef.current = "unavailable";
    packFailedRef.current = true;
    clearTimer();
    preparingRef.current = false;
    setPreparing(false);
    if (deferCloudAttempt()) return;
    fail(diagnose());
  }, [clearTimer, deferCloudAttempt, diagnose, fail]);

  /**
   * Abandon the cloud session and come up on the local engine, installing the
   * language pack first if it is not there yet. The install is a one-time
   * download of real size, which is why it is never done speculatively — only
   * once the cloud engine has actually failed, and with the wait on screen.
   */
  const goLocal = useCallback(() => {
    const Ctor = getConstructor();
    const install = Ctor?.install;
    const available = Ctor?.available;
    if (!Ctor || !install || !available) {
      abandonLocal();
      return;
    }

    clearTimer();
    epochRef.current += 1;
    const epoch = epochRef.current;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setError(null);
    setInterim("");
    setListening(false);

    if (localRef.current === "available") {
      setNotice(copy.switching);
      // A short gap: Chrome reports `network` again if a new session opens while
      // the previous one is still tearing down.
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        if (epoch === epochRef.current) launchRef.current("local");
      }, 250);
      return;
    }

    setNotice(copy.preparing);
    preparingRef.current = true;
    setPreparing(true);

    let settled = false;
    const conclude = (installed: boolean) => {
      if (settled || epoch !== epochRef.current) return;
      settled = true;
      clearTimer();
      if (!installed) {
        abandonLocal();
        return;
      }
      localRef.current = "available";
      preparingRef.current = false;
      setPreparing(false);
      launchRef.current("local");
    };

    install({ langs: [lang], processLocally: true }).then(
      (installed) => conclude(installed),
      () => conclude(false),
    );

    // `install()` is not reliably a promise that settles. A browser that reports
    // a pack as downloadable but cannot actually fetch it — one with the vendor's
    // model service stripped out, say — leaves it pending forever, which is a
    // spinner the user can never get out of. So watch `available()` for signs of
    // life instead of trusting it: "downloading" is real progress and buys more
    // time, and anything else for long enough means the fetch never started.
    const deadline = Date.now() + MAX_PREPARE_MS;
    let patienceUntil = Date.now() + STALL_MS;
    watchdogRef.current = window.setInterval(() => {
      if (settled || epoch !== epochRef.current) {
        clearTimer();
        return;
      }
      // Checked here rather than in the callback below, so a hanging
      // `available()` cannot stall the watchdog the way `install()` can.
      if (Date.now() > patienceUntil || Date.now() > deadline) {
        conclude(false);
        return;
      }
      available({ langs: [lang], processLocally: true }).then((status) => {
        if (status === "available") conclude(true);
        else if (status === "downloading") {
          setNotice(copy.downloading);
          patienceUntil = Date.now() + STALL_MS;
        }
      }, noop);
    }, POLL_MS);
  }, [abandonLocal, clearTimer, copy, lang]);

  /**
   * Map an error code to the next move. The cloud engine gets exactly two
   * escapes from `network` — the local engine if it can be had, otherwise one
   * retry — and after that the user is told what is actually wrong.
   */
  const handleError = useCallback(
    (code: string, engine: Engine) => {
      // We abort the previous session on every restart and on unmount. That is
      // bookkeeping, not something the user needs to read.
      if (code === "aborted") return;

      switch (code) {
        case "no-speech":
          fail(copy.noSpeech);
          return;

        case "audio-capture":
          fail(copy.noMic);
          return;

        case "not-allowed":
          fail(copy.permission);
          return;

        case "service-not-allowed":
          // Not purely a permissions refusal: it is also how an engine says it
          // will not serve the request at all — a Chromium build with no speech
          // backend, or a local engine that turns out not to work. The other
          // engine is worth one try before the user is told about permissions.
          if (engine === "cloud") {
            if (canGoLocal()) {
              goLocal();
              return;
            }
            fail(copy.permission);
            return;
          }
          localRef.current = "unavailable";
          if (deferCloudAttempt()) return;
          fail(copy.permission);
          return;

        case "language-not-supported":
          // An installed pack that does not cover this language. The cloud
          // engine may still know it, so drop back to it once.
          if (engine === "local") {
            localRef.current = "unavailable";
            if (deferCloudAttempt()) return;
          }
          fail(copy.langUnsupported);
          return;

        case "network":
          // Only the cloud engine should be able to produce this — the local one
          // opens no socket. If a local session reports it anyway, stop trusting
          // the local engine rather than bouncing back to it forever.
          if (engine === "local") localRef.current = "unavailable";
          else if (canGoLocal()) {
            goLocal();
            return;
          }
          if (deferCloudAttempt()) return;
          fail(diagnose());
          return;

        default:
          fail(copy.generic);
          return;
      }
    },
    [canGoLocal, copy, deferCloudAttempt, diagnose, fail, goLocal],
  );

  /** Open a session on one specific engine. Everything else routes through this. */
  const launch = useCallback(
    (engine: Engine) => {
      const Ctor = getConstructor();
      if (!Ctor) return;

      epochRef.current += 1;
      const epoch = epochRef.current;
      const current = () => epoch === epochRef.current;

      recognitionRef.current?.abort();

      const recognition = new Ctor();
      recognition.lang = lang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      // Setting this on an engine that predates it is harmless; such an engine
      // is only ever asked for "cloud" anyway, since the probe said unavailable.
      if (engine === "local") recognition.processLocally = true;

      recognition.onresult = (event) => {
        if (!current()) return;
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
        if (!current()) return;
        handleError(event.error, engine);
      };

      recognition.onend = () => {
        if (!current()) return;
        setListening(false);
        setInterim("");
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
        setError(null);
        setNotice(null);
        setInterim("");
        setListening(true);
      } catch {
        setError(copy.cannotStart);
        setNotice(null);
        setListening(false);
      }
    },
    [copy, handleError, lang],
  );

  useEffect(() => {
    launchRef.current = launch;
  }, [launch]);

  const stop = useCallback(() => {
    clearTimer();
    if (preparingRef.current) {
      // Nothing is being recorded yet, so there is no transcript to lose: walk
      // away from the pending install by invalidating its callbacks. The local
      // engine is struck off for the rest of the page's life, because the next
      // click should reach for the cloud rather than re-enter the same wait.
      epochRef.current += 1;
      preparingRef.current = false;
      setPreparing(false);
      localRef.current = "unavailable";
    }
    setNotice(null);
    recognitionRef.current?.stop();
    setListening(false);
  }, [clearTimer]);

  const start = useCallback(() => {
    retriedRef.current = false;
    clearTimer();
    setError(null);
    setNotice(null);
    setInterim("");
    // Local when the pack is already installed — no network in the loop at all.
    // "downloadable" deliberately still starts on the cloud engine: a working
    // cloud path should not cost the user an unasked-for download.
    launch(localRef.current === "available" ? "local" : "cloud");
  }, [clearTimer, launch]);

  const toggle = useCallback(() => {
    if (listening || preparing) stop();
    else start();
  }, [listening, preparing, start, stop]);

  return { supported, listening, preparing, interim, error, notice, start, stop, toggle };
}
