import type { AssistantEvent } from "@lobby/ai";

/** Streams assistant events to the browser as newline-delimited JSON. */
export function ndjson(events: AsyncGenerator<AssistantEvent>): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (done) return controller.close();
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
      } catch (err) {
        console.error("[assistant] stream failed", err);
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "error", message: "Something went wrong." })}\n`));
        controller.close();
      }
    },
    async cancel() {
      await events.return(undefined);
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
