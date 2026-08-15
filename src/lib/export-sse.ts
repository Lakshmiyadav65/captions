/** Split an SSE buffer into complete `data:` JSON events. */
export function consumeSseChunks<T>(buffer: string, chunk: string): { buffer: string; events: T[] } {
  const combined = `${buffer}${chunk}`;
  const parts = combined.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: T[] = [];
  for (const part of parts) {
    const line = part
      .split("\n")
      .map((entry) => entry.trimEnd())
      .find((entry) => entry.startsWith("data:"));
    if (!line) continue;
    const json = line.replace(/^data:\s?/, "");
    if (!json || json === "[DONE]") continue;
    try {
      events.push(JSON.parse(json) as T);
    } catch {
      /* ignore a partial/malformed frame */
    }
  }
  return { buffer: rest, events };
}

export async function readSseStream<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const { buffer: next, events } = consumeSseChunks<T>(buffer, decoder.decode(value, { stream: true }));
      buffer = next;
      for (const event of events) onEvent(event);
    }
    const { events } = consumeSseChunks<T>(buffer, "\n\n");
    for (const event of events) onEvent(event);
  } finally {
    reader.releaseLock();
  }
}
