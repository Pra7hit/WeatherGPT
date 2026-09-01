"use client";

import { useSyncExternalStore } from "react";

import { useChat } from "@/hooks/useChat";
import {
  readLanguage,
  readLocation,
  serverLanguage,
  serverLocation,
  subscribePrefs,
  writeLanguage,
  writeLocation,
} from "@/lib/prefs";

import { Composer } from "./Composer";
import { Header } from "./Header";
import { MessageList } from "./MessageList";

/**
 * The application shell: header, transcript, composer.
 *
 * Language and the default location live in the prefs store (localStorage) because
 * both the header controls and every outgoing request need them. Everything else -
 * the transcript, streaming, and localStorage persistence of the conversation -
 * belongs to useChat.
 */

export function ChatShell() {
  const language = useSyncExternalStore(subscribePrefs, readLanguage, serverLanguage);
  const location = useSyncExternalStore(subscribePrefs, readLocation, serverLocation);

  const chat = useChat({ language, location });

  const streaming = chat.status === "streaming";

  return (
    <div className="flex h-dvh flex-col">
      <Header
        language={language}
        location={location}
        onLanguageChange={writeLanguage}
        onLocationChange={writeLocation}
        onNewChat={chat.newChat}
      />

      <MessageList
        messages={chat.messages}
        language={language}
        streaming={streaming}
        onPick={(question) => void chat.send(question)}
        onRetry={chat.retry}
      />

      <Composer
        language={language}
        streaming={streaming}
        onSend={(text) => void chat.send(text)}
        onStop={chat.stop}
      />
    </div>
  );
}
