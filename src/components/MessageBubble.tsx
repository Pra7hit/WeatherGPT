"use client";

import type { ChatMessage, Language } from "@/lib/types";
import { t } from "@/lib/uiText";

import { AlertCard } from "./AlertCard";
import { Markdown } from "./Markdown";
import { WeatherCard } from "./WeatherCard";
import { InfoIcon, SparkIcon } from "./icons";

/**
 * One turn of the conversation.
 *
 * The user's question is a bubble; the assistant's answer is flowing text with
 * its data cards underneath - the arrangement the brief asks for, prose first
 * and the numbers as supporting evidence.
 */

/** Evidence settles in behind the prose; the ramp is capped so a five-card
 *  answer does not turn into a slideshow. */
function stagger(index: number): string {
  return `${Math.min(index, 4) * 70}ms`;
}

function ToolTrace({ labels, title }: { labels: string[]; title: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="text-ink-3 overline">{title}</span>
      {labels.map((label) => (
        <span
          key={label}
          className="border-line bg-surface-2 text-ink-2 text-label rounded-full border px-2 py-0.5"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 py-1" aria-hidden="true">
      <span className="animate-dot bg-ink-3 h-1.5 w-1.5 rounded-full" />
      <span
        className="animate-dot bg-ink-3 h-1.5 w-1.5 rounded-full"
        style={{ animationDelay: "160ms" }}
      />
      <span
        className="animate-dot bg-ink-3 h-1.5 w-1.5 rounded-full"
        style={{ animationDelay: "320ms" }}
      />
    </span>
  );
}

export function MessageBubble({
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
    // No entrance animation: the user just pressed enter, so this should already
    // be on screen. Animating direct manipulation reads as lag.
    return (
      <div className="flex justify-end">
        <div className="bg-accent text-on-accent shadow-e1 text-body max-w-[85%] rounded-2xl rounded-br-md px-4 py-2.5">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  const streaming = message.status === "streaming";
  const cards = message.cards ?? [];
  const alerts = message.alerts ?? [];
  const trace = message.toolTrace ?? [];

  return (
    <div className="flex gap-3">
      <span className="bg-accent-soft text-accent-ink border-accent-line mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border">
        <SparkIcon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1 space-y-3">
        {message.notice ? (
          <p className="border-sev-moderate-line bg-sev-moderate text-sev-moderate-ink text-caption flex items-start gap-2 rounded-xl border px-3 py-2">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message.notice}</span>
          </p>
        ) : null}

        {trace.length > 0 ? <ToolTrace labels={trace} title={copy.lookups} /> : null}

        {message.content.trim().length > 0 ? (
          <div className="text-ink animate-answer">
            <Markdown text={message.content} caret={streaming} />
          </div>
        ) : streaming ? (
          <div className="text-ink-2 text-caption flex items-center gap-2" role="status">
            <TypingDots />
            <span>{copy.thinking}</span>
          </div>
        ) : null}

        {alerts.map((alert, index) => (
          <div key={alert.id} className="animate-settle" style={{ animationDelay: stagger(index) }}>
            <AlertCard alert={alert} language={language} />
          </div>
        ))}

        {cards.map((card, index) => (
          <div
            key={card.id}
            className="animate-settle"
            style={{ animationDelay: stagger(alerts.length + index) }}
          >
            <WeatherCard card={card} language={language} />
          </div>
        ))}

        {message.error ? (
          <div className="border-sev-severe-line bg-sev-severe text-sev-severe-ink text-caption rounded-xl border px-3 py-2.5">
            <p>{message.error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="border-sev-severe-line hover:bg-sev-severe-ink/10 mt-2 rounded-md border px-2.5 py-1 font-medium transition-colors duration-150"
              >
                {copy.retry}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
