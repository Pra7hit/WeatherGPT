import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { env } from "@/lib/env";
import { isValidTimeZone } from "@/lib/time";
import type { ChatRequestBody, StreamFrame } from "@/lib/types";
import { createExecContext, executeTool } from "./execute";
import { buildSystem } from "./systemPrompt";
import { TOOLS } from "./tools";

/**
 * The conversational layer: a streaming manual tool-use loop.
 *
 * We drive the loop by hand (rather than using the SDK tool runner) because each
 * tool result has to be intercepted on its way past - text deltas stream to the
 * browser as they arrive, and every weather card / alert card produced by a tool
 * is pushed to the client in the same stream.
 *
 * Note on `fallbacks`: server-side model fallbacks live on the beta Messages
 * namespace and are an availability optimisation, not a functional requirement.
 * Requests here may be routed through a third-party gateway (ANTHROPIC_BASE_URL)
 * that need not support beta features, so this uses the stable endpoint only.
 */

const MAX_ITERATIONS = 6;
const MAX_TOKENS = 16_000;
const MAX_HISTORY = 24;
const DEFAULT_TIMEZONE = "Asia/Kolkata";

export type Emit = (frame: StreamFrame) => void;

let cachedClient: Anthropic | null = null;

export function isLlmConfigured(): boolean {
  return Boolean(env.anthropicApiKey);
}

function getClient(): Anthropic | null {
  if (!env.anthropicApiKey) return null;
  cachedClient ??= new Anthropic({
    apiKey: env.anthropicApiKey,
    baseURL: env.anthropicBaseUrl,
    maxRetries: 2,
    timeout: 120_000,
  });
  return cachedClient;
}

/**
 * Normalise the browser-supplied history into valid `messages`: drop blanks, keep
 * the tail, merge same-role neighbours, and make sure it opens with a user turn.
 */
function toMessages(body: ChatRequestBody): Anthropic.MessageParam[] {
  const cleaned = body.messages
    .filter((message) => typeof message.content === "string" && message.content.trim().length > 0)
    .slice(-MAX_HISTORY);

  const messages: Anthropic.MessageParam[] = [];
  for (const message of cleaned) {
    const previous = messages[messages.length - 1];
    if (previous && previous.role === message.role && typeof previous.content === "string") {
      previous.content = `${previous.content}\n\n${message.content.trim()}`;
      continue;
    }
    if (messages.length === 0 && message.role !== "user") continue;
    messages.push({ role: message.role, content: message.content.trim() });
  }
  return messages;
}

function errorMessage(error: unknown): string {
  if (error instanceof Anthropic.APIError) {
    const status = error.status ? `${error.status} ` : "";
    return `The AI service returned an error (${status}${error.name}). ${error.message}`;
  }
  if (error instanceof Error) return error.message;
  return "unknown error";
}

export interface RunOptions {
  body: ChatRequestBody;
  emit: Emit;
  signal?: AbortSignal;
}

export async function runConversation({ body, emit, signal }: RunOptions): Promise<void> {
  const client = getClient();
  if (!client) {
    emit({ t: "error", message: "ANTHROPIC_API_KEY is not configured on the server." });
    return;
  }

  const messages = toMessages(body);
  if (messages.length === 0) {
    emit({ t: "error", message: "no user message to answer" });
    return;
  }

  const timezone = isValidTimeZone(body.timezone) ? body.timezone! : DEFAULT_TIMEZONE;
  const system = buildSystem({
    timezone,
    language: body.language ?? "auto",
    location: body.location ?? null,
  });
  const ctx = createExecContext(body.language === "hi" ? "hi" : "en", body.location ?? null);

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    let message: Anthropic.Message;
    try {
      const stream = client.messages.stream(
        {
          model: env.llmModel,
          max_tokens: MAX_TOKENS,
          system,
          tools: TOOLS,
          messages,
          thinking: { type: "adaptive" },
          output_config: { effort: env.llmEffort },
        },
        { signal },
      );
      stream.on("text", (delta) => emit({ t: "text", d: delta }));
      message = await stream.finalMessage();
    } catch (error) {
      if (signal?.aborted) return;
      emit({ t: "error", message: errorMessage(error) });
      return;
    }

    if (message.stop_reason === "refusal") {
      emit({
        t: "notice",
        message:
          "The model declined to continue this response. Try rephrasing, or start a new chat.",
      });
      return;
    }

    if (message.content.length === 0) return;
    messages.push({ role: "assistant", content: message.content });

    // The model paused a long turn: resend the conversation unchanged to resume.
    if (message.stop_reason === "pause_turn") continue;

    const toolUses = message.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    if (toolUses.length === 0) return;

    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      if (signal?.aborted) return;
      const outcome = await executeTool(toolUse.name, toolUse.input, ctx);

      emit({ t: "tool", name: toolUse.name, label: outcome.label });
      for (const card of outcome.cards) emit({ t: "card", card });
      for (const alert of outcome.alerts) emit({ t: "alert", alert });

      results.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: outcome.content,
        is_error: outcome.isError,
      });
    }

    messages.push({ role: "user", content: results });
  }

  emit({
    t: "notice",
    message: `Stopped after ${MAX_ITERATIONS} data lookups for this question. Ask something more specific and I will try again.`,
  });
}
