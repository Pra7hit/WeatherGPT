"use client";

import { useEffect, useRef } from "react";

import type { ChatMessage, Language } from "@/lib/types";

import { MessageBubble } from "./MessageBubble";
import { SuggestedQuestions } from "./SuggestedQuestions";

/**
 * The transcript. Follows the newest content while streaming, but stops
 * following as soon as the user scrolls up to re-read something.
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
    if (!node || !pinnedRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [signature, streaming]);

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => {
        const node = event.currentTarget;
        pinnedRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 120;
      }}
      className="scrollbar-slim flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="mx-auto w-full max-w-3xl px-4 pt-5 pb-10 sm:px-6">
        {messages.length === 0 ? (
          <SuggestedQuestions language={language} onPick={onPick} />
        ) : (
          <div className="space-y-7">
            {messages.map((message) => (
              <MessageBubble
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
