"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage, Language } from "@/lib/types";

import { SuggestedQuestions } from "./SuggestedQuestions";
import { Turn } from "./Turn";

/**
 * The transcript. Follows the newest content while streaming, but stops
 * following as soon as the user scrolls up to re-read something.
 *
 * The turns carry their own rules — 2px for a question, a hairline for an answer
 * — so this only has to hold the measure and the rhythm between them.
 */
export function MessageList({
  messages,
  language,
  streaming,
  onPick,
  onRetry,
}: {
  messages: ChatMessage[];
  language: Language;
  streaming: boolean;
  onPick: (question: string) => void;
  onRetry: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const lastMessage = messages[messages.length - 1];
  const signature = `${messages.length}:${lastMessage?.content.length ?? 0}:${
    lastMessage?.cards?.length ?? 0
  }:${lastMessage?.alerts?.length ?? 0}`;

  useEffect(() => {
    const node = scrollRef.current;
    // The empty state is a top-of-page read: following it would open the app
    // halfway down the suggestion list with the heading scrolled off.
    if (!node || !pinnedRef.current || messages.length === 0) return;
    node.scrollTop = node.scrollHeight;
  }, [signature, streaming, messages.length]);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const node = event.currentTarget;
        pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
      }}
      className="scrollbar-hair flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto w-full max-w-3xl px-4 pt-4 pb-12 sm:px-6">
        {messages.length === 0 ? (
          <SuggestedQuestions language={language} onPick={onPick} />
        ) : (
          <div className="space-y-6">
            {messages.map((message) => (
              <Turn
                key={message.id}
                message={message}
                language={language}
                onRetry={message.status === "error" ? onRetry : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
