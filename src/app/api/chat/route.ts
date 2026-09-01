import {
  LIMITS,
  acquireChatSlot,
  callerKey,
  checkRateLimit,
  sanitizeText,
} from "@/lib/guardrails";
import { frameResponse } from "@/lib/sse";
import type { ChatRequestBody, ClientLocation, Language } from "@/lib/types";
import { isLlmConfigured, runConversation } from "@/services/ai";
import { runFallback } from "@/services/ai/fallback";

/**
 * The chat endpoint. Node runtime because the service layer is server-only and
 * talks to several upstream APIs; streaming is plain SSE.
 *
 * Everything crossing this boundary is treated as untrusted: the body is
 * validated field by field, text is sanitised, history is bounded, and the
 * caller is rate limited before a single token is spent.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A tool-use turn plus a streamed answer routinely outruns the 10s serverless
 *  default; 60s is the ceiling on Vercel's free tier. */
export const maxDuration = 60;

const LANGUAGES: Language[] = ["auto", "en", "hi"];

function parseLocation(value: unknown): ClientLocation | null {
  if (value === null || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const latitude = Number(raw.latitude);
  const longitude = Number(raw.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const source = raw.source;
  const name = typeof raw.name === "string" ? sanitizeText(raw.name).slice(0, 120) : "";
  return {
    latitude,
    longitude,
    name: name.length > 0 ? name : undefined,
    source:
      source === "geolocation" || source === "search" || source === "manual" ? source : "manual",
  };
}

type Turn = { role: "user" | "assistant"; content: string };

/** Newest turns win: history is trimmed from the front until it fits the budget. */
function withinBudget(messages: Turn[]): Turn[] {
  const recent = messages.slice(-LIMITS.maxMessages);
  let total = recent.reduce((sum, turn) => sum + turn.content.length, 0);
  while (recent.length > 1 && total > LIMITS.maxTotalChars) {
    total -= recent.shift()!.content.length;
  }
  return recent;
}

function parseBody(payload: unknown): ChatRequestBody | null {
  if (payload === null || typeof payload !== "object") return null;
  const raw = payload as Record<string, unknown>;
  if (!Array.isArray(raw.messages)) return null;

  const messages = raw.messages
    .map((entry): Turn | null => {
      if (entry === null || typeof entry !== "object") return null;
      const item = entry as Record<string, unknown>;
      const role = item.role === "assistant" ? "assistant" : item.role === "user" ? "user" : null;
      if (!role || typeof item.content !== "string") return null;
      // Bound a single turn so a pasted wall of text cannot blow up the request.
      const content = sanitizeText(item.content).slice(0, LIMITS.maxTurnChars);
      return content.length > 0 ? { role, content } : null;
    })
    .filter((entry): entry is Turn => entry !== null);

  if (messages.length === 0) return null;

  const language = LANGUAGES.includes(raw.language as Language)
    ? (raw.language as Language)
    : "auto";

  return {
    messages: withinBudget(messages),
    language,
    timezone: typeof raw.timezone === "string" ? raw.timezone.slice(0, 64) : undefined,
    location: parseLocation(raw.location),
  };
}

export async function POST(request: Request): Promise<Response> {
  const rate = checkRateLimit(callerKey(request));
  if (!rate.ok) {
    return Response.json(
      {
        error: `Too many requests. Please wait ${rate.retryAfter}s. This limit exists so a runaway client cannot spend the API budget.`,
      },
      { status: 429, headers: { "Retry-After": String(rate.retryAfter) } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const body = parseBody(payload);
  if (!body) {
    return Response.json({ error: "expected { messages: [{ role, content }] }" }, { status: 400 });
  }

  const release = acquireChatSlot();
  if (!release) {
    return Response.json(
      { error: "The server is handling too many conversations right now. Try again shortly." },
      { status: 503, headers: { "Retry-After": "5" } },
    );
  }

  try {
    return frameResponse(async (emit) => {
      try {
        if (!isLlmConfigured()) {
          await runFallback(body, emit);
          return;
        }
        await runConversation({ body, emit, signal: request.signal });
      } finally {
        release();
      }
    });
  } catch (error) {
    // frameResponse itself failing would otherwise leak the slot.
    release();
    throw error;
  }
}
