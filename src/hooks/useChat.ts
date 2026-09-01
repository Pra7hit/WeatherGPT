"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AlertCardData,
  ChatMessage,
  ClientLocation,
  Conversation,
  Language,
  StreamFrame,
  WeatherCardData,
} from "@/lib/types";

/**
 * Conversation state, streaming, and persistence.
 *
 * The transcript lives in localStorage only - no database, so `npm run dev` is
 * the whole setup. History is sent back to /api/chat on every turn, which is
 * what makes "What about tomorrow evening?" resolve against the city named three
 * turns earlier: the model, not a parser, does the resolving.
 */

const STORAGE_KEY = "weathergpt.conversation.v1";
/** Enough context for follow-ups without paying for an unbounded prompt. */
const MAX_HISTORY = 24;

export type ChatStatus = "idle" | "streaming";

export interface UseChatOptions {
  language: Language;
  location: ClientLocation | null;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function titleOf(messages: ChatMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.content ?? "New chat";
  return first.length > 60 ? `${first.slice(0, 57)}…` : first;
}

function localTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

/** Reads back a stored transcript defensively - the shape may predate a change. */
function loadStored(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<Conversation>;
    if (!Array.isArray(parsed.messages)) return [];
    return parsed.messages
      .filter(
        (message): message is ChatMessage =>
          typeof message?.content === "string" &&
          (message.role === "user" || message.role === "assistant"),
      )
      // A transcript saved mid-stream must not come back looking live.
      .map((message) => (message.status === "streaming" ? { ...message, status: "done" } : message));
  } catch {
    return [];
  }
}

export function useChat({ language, location }: UseChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [loaded, setLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string>("");
  const optionsRef = useRef({ language, location });
  optionsRef.current = { language, location };

  useEffect(() => {
    conversationIdRef.current = newId();
    setMessages(loadStored());
    setLoaded(true);
    return () => abortRef.current?.abort();
  }, []);

  // Persist after every change, including mid-stream, so a refresh keeps the answer.
  useEffect(() => {
    if (!loaded) return;
    try {
      if (messages.length === 0) {
        localStorage.removeItem(STORAGE_KEY);
        return;
      }
      const conversation: Conversation = {
        id: conversationIdRef.current,
        title: titleOf(messages),
        messages,
        createdAt: messages[0]?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversation));
    } catch {
      // Storage full or blocked: the session still works, it just will not survive a reload.
    }
  }, [messages, loaded]);

  const patch = useCallback((id: string, update: (message: ChatMessage) => ChatMessage) => {
    setMessages((current) =>
      current.map((message) => (message.id === id ? update(message) : message)),
    );
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    conversationIdRef.current = newId();
    setMessages([]);
    setStatus("idle");
  }, []);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || abortRef.current) return;

      const userMessage: ChatMessage = {
        id: newId(),
        role: "user",
        content: question,
        createdAt: Date.now(),
      };
      const answerId = newId();
      const answer: ChatMessage = {
        id: answerId,
        role: "assistant",
        content: "",
        cards: [],
        alerts: [],
        toolTrace: [],
        status: "streaming",
        createdAt: Date.now(),
      };

      // Snapshot the history the model should see, before this turn is appended.
      let history: Array<{ role: "user" | "assistant"; content: string }> = [];
      setMessages((current) => {
        history = current
          .filter((message) => message.content.trim().length > 0)
          .slice(-MAX_HISTORY)
          .map((message) => ({ role: message.role, content: message.content }));
        return [...current, userMessage, answer];
      });

      const controller = new AbortController();
      abortRef.current = controller;
      setStatus("streaming");

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, { role: "user", content: question }],
            language: optionsRef.current.language,
            timezone: localTimezone(),
            location: optionsRef.current.location,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          throw new Error(
            `The server responded ${response.status}. ${detail.slice(0, 200)}`.trim(),
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let text_ = "";
        const cards: WeatherCardData[] = [];
        const alerts: AlertCardData[] = [];
        const trace: string[] = [];
        let notice: string | undefined;
        let failure: string | undefined;

        const flush = () => {
          patch(answerId, (message) => ({
            ...message,
            content: text_,
            cards: [...cards],
            alerts: [...alerts],
            toolTrace: [...trace],
            notice,
            error: failure,
          }));
        };

        // Newline-delimited SSE: blank line terminates an event, "data:" carries the frame.
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";

          for (const event of events) {
            for (const line of event.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const raw = line.slice(5).trim();
              if (!raw) continue;

              let frame: StreamFrame;
              try {
                frame = JSON.parse(raw) as StreamFrame;
              } catch {
                continue;
              }

              switch (frame.t) {
                case "text":
                  text_ += frame.d;
                  break;
                case "card":
                  cards.push(frame.card);
                  break;
                case "alert":
                  alerts.push(frame.alert);
                  break;
                case "tool":
                  if (!trace.includes(frame.label)) trace.push(frame.label);
                  break;
                case "notice":
                  notice = frame.message;
                  break;
                case "error":
                  failure = frame.message;
                  break;
                case "done":
                  break;
              }
            }
            flush();
          }
        }

        flush();
        patch(answerId, (message) => ({
          ...message,
          status: message.error ? "error" : "done",
        }));
      } catch (error) {
        const aborted = error instanceof DOMException && error.name === "AbortError";
        if (aborted) {
          // Drop an answer the user cancelled before it said anything.
          setMessages((current) =>
            current.filter(
              (message) =>
                message.id !== answerId ||
                message.content.trim().length > 0 ||
                (message.cards?.length ?? 0) > 0 ||
                (message.alerts?.length ?? 0) > 0,
            ),
          );
          patch(answerId, (message) => ({ ...message, status: "done" }));
        } else {
          patch(answerId, (message) => ({
            ...message,
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "The request failed before any data was returned.",
          }));
        }
      } finally {
        abortRef.current = null;
        setStatus("idle");
      }
    },
    [patch],
  );

  const retry = useCallback(() => {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUser || status === "streaming") return;
    // Drop everything after that question, then ask it again.
    const index = messages.findIndex((message) => message.id === lastUser.id);
    setMessages(messages.slice(0, index));
    void send(lastUser.content);
  }, [messages, send, status]);

  return { messages, status, loaded, send, stop, newChat, retry };
}
