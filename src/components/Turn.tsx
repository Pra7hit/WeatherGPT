"use client";

import { useEffect, useState } from "react";

import type { ChatMessage, Language } from "@/lib/types";
import { t, uiLang } from "@/lib/uiText";

import { AlertCard } from "./AlertCard";
import { Markdown } from "./Markdown";
import { ScanStrip } from "./ScanStrip";
import { WeatherCard } from "./WeatherCard";
import { InfoIcon } from "./icons";

/**
 * One turn of the conversation.
 *
 * There are no bubbles and no avatar here. A question is a ruled QUERY line; an
 * answer is prose in the sans under a hairline rule, with the log of what was
 * fetched printed above it and the evidence plates below. The log stays on
 * screen after the answer lands, because the retrieval is part of the record
 * rather than a spinner that clears itself.
 */

function stamp(ms: number, language: Language): string {
  return new Intl.DateTimeFormat(uiLang(language) === "hi" ? "hi-IN" : "en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

/**
 * The retrieval's own duration: live while the answer streams, frozen the moment
 * it lands, and absent for a turn restored from storage, where the number would
 * be the age of the conversation rather than the time a lookup took.
 *
 * It lives in its own component so a 200ms tick re-renders four digits instead
 * of the whole turn and every plate under it.
 */
function Elapsed({ from, running, label }: { from: number; running: boolean; label: string }) {
  const [seconds, setSeconds] = useState<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const tick = () => setSeconds(Math.max(0, (Date.now() - from) / 1000));
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [from, running]);

  if (seconds === null) return null;

  return (
    <span className="mono-label shrink-0">
      {label} {seconds.toFixed(1)}s
    </span>
  );
}

export function Turn({
  message,
  language,
  onRetry,
}: {
  message: ChatMessage;
  language: Language;
  onRetry?: () => void;
}) {
  const copy = t(language);

  if (message.role === "user") {
    // No entrance: the user just pressed send, so this is already on screen.
    // Animating direct manipulation reads as lag.
    return (
      <article className="border-ink border-t-2 pt-2">
        <div className="mono-label flex items-baseline gap-2">
          <span className="field-solid shrink-0 px-1.5 py-1">{copy.query}</span>
          <span aria-hidden="true" className="border-hair flex-1 border-t" />
          <span className="numeric shrink-0">{stamp(message.createdAt, language)}</span>
        </div>
        <p className="text-lead mt-2 max-w-[68ch] whitespace-pre-wrap">{message.content}</p>
      </article>
    );
  }

  const streaming = message.status === "streaming";
  const cards = message.cards ?? [];
  const alerts = message.alerts ?? [];
  const trace = message.toolTrace ?? [];
  const hasProse = message.content.trim().length > 0;

  return (
    <article className="border-hair border-t pt-2">
      <div className="mono-label flex items-baseline gap-2">
        <span className="shrink-0">{copy.brand}</span>
        <span aria-hidden="true" className="border-hair flex-1 border-t" />
        <Elapsed from={message.createdAt} running={streaming} label={copy.elapsed} />
        {/* The retrieval's duration and the wall clock are two different numbers,
            so they are boxed apart: "ELAPSED 15.0S 20:35" read as one. */}
        <span className="numeric border-hair-3 shrink-0 border-l pl-2">
          {stamp(message.createdAt, language)}
        </span>
      </div>

      {message.notice ? (
        <p className="border-ink mt-2 flex items-start gap-2 border border-dashed px-2 py-1.5">
          <InfoIcon className="mt-px h-3.5 w-3.5 shrink-0" />
          <span className="numeric text-caption">{message.notice}</span>
        </p>
      ) : null}

      {trace.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="mono-label">{copy.lookups}</span>
          {trace.map((label) => (
            <span key={label} className="mono-label border-hair-3 border px-1.5 py-0.5">
              {label}
            </span>
          ))}
        </div>
      ) : null}

      {streaming && !hasProse ? (
        <div role="status" className="mt-2.5 flex items-center gap-3">
          <span className="mono-label shrink-0">{copy.scanning}</span>
          <span className="sr-only">{copy.thinking}</span>
          <ScanStrip className="min-w-0 flex-1" />
        </div>
      ) : null}

      {hasProse ? (
        <div className="mt-2.5">
          <Markdown text={message.content} caret={streaming} />
        </div>
      ) : null}

      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} language={language} />
      ))}

      {cards.map((card) => (
        <WeatherCard key={card.id} card={card} language={language} />
      ))}

      {message.error ? (
        <div className="border-ink mt-4 border-[3px] p-3">
          <p className="text-body max-w-[68ch]">{message.error}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="switch mt-2.5">
              {copy.retry}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
