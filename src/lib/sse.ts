import type { StreamFrame } from "./types";

/**
 * Server-Sent-Events plumbing for /api/chat.
 *
 * Frames are `StreamFrame` JSON objects, one per SSE `data:` line, so the client
 * gets text deltas, weather cards, alert cards and notices over a single
 * connection. A `done` frame always terminates the stream, including after an
 * error, so the client never has to guess whether more is coming.
 */

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  // Disables proxy buffering, which would otherwise defeat streaming.
  "X-Accel-Buffering": "no",
} as const;

export function frameResponse(
  run: (emit: (frame: StreamFrame) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const emit = (frame: StreamFrame) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
        } catch {
          // The client went away mid-stream; stop emitting.
          open = false;
        }
      };

      try {
        await run(emit);
      } catch (error) {
        emit({
          t: "error",
          message: error instanceof Error ? error.message : "unexpected server error",
        });
      } finally {
        emit({ t: "done" });
        open = false;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
