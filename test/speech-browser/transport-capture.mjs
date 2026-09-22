import { z } from "zod";

const header = z
  .object({
    sessionId: z.uuid(),
    sequence: z.number().int().min(0).max(300),
    audio: z
      .object({ _placeholder: z.literal(true), num: z.literal(0) })
      .strict(),
  })
  .strict();

// Test-only observer, not an audio logger in the application. At most 8 sessions.
export function createTransportCapture(save) {
  const sessions = new Map();
  let pending;
  return (payload) => {
    if (typeof payload !== "string") {
      if (!pending) return;
      const { sessionId, sequence } = pending;
      pending = undefined;
      const entry = sessions.get(sessionId);
      if (!entry || entry.invalid) return;
      if (
        !payload.length ||
        payload.length % 2 ||
        payload.length > 16000 ||
        sequence !== entry.chunks.length ||
        entry.bytes + payload.length > 384000
      ) {
        entry.invalid = true;
        entry.chunks = [];
        return;
      }
      entry.chunks.push(Buffer.from(payload));
      entry.bytes += payload.length;
      return;
    }
    if (pending) {
      const entry = sessions.get(pending.sessionId);
      if (entry) {
        entry.invalid = true;
        entry.chunks = [];
      }
      pending = undefined;
    }
    if (!/^(?:451-|42)\d*\[/.test(payload)) return;
    let event;
    try {
      event = JSON.parse(payload.slice(payload.indexOf("[")));
    } catch {
      return;
    }
    if (!Array.isArray(event)) return;
    if (event[0] === "speech_chunk" && payload.startsWith("451-")) {
      const parsed = header.safeParse(event[1]);
      if (!parsed.success) {
        pending = undefined;
        return;
      }
      pending = parsed.data;
      if (!sessions.has(pending.sessionId) && sessions.size < 8)
        sessions.set(pending.sessionId, {
          chunks: [],
          bytes: 0,
          invalid: false,
        });
    } else if (event[0] === "speech_finish" && payload.startsWith("42")) {
      const entry = sessions.get(event[1]?.sessionId);
      if (
        entry &&
        !entry.invalid &&
        entry.chunks.length &&
        event[1].lastSequence === entry.chunks.length - 1
      ) {
        save(event[1].sessionId, Buffer.concat(entry.chunks));
        entry.chunks = [];
        entry.invalid = true;
      }
    }
  };
}
