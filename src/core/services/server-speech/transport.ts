import { z } from "zod";
import type { SpeechEvent, SpeechPayload } from "@/core/@types/server-speech";
import { getSocket } from "../socket-service";

const acknowledgement = z
  .object({
    result: z.enum(["ok", "error"]),
    code: z
      .string()
      .regex(/^STT_[A-Z_]+$/)
      .optional(),
    sessionId: z.uuid().optional(),
    version: z.literal(1).optional(),
    sequence: z.number().int().nonnegative().optional(),
    segments: z.number().int().nonnegative().optional(),
    locale: z.literal("pt-BR").optional(),
  })
  .strict();

export async function requestSpeech(
  event: SpeechEvent,
  payload: SpeechPayload,
) {
  const socket = getSocket();
  if (!socket.connected) throw new Error("STT_DISCONNECTED");
  const timeout = event === "speech_finish" ? 3500 : 1500;
  let response: unknown;
  try {
    response = await socket.timeout(timeout).emitWithAck(event, payload);
  } catch {
    throw new Error("STT_ACK_TIMEOUT");
  }
  const parsed = acknowledgement.safeParse(response);
  if (!parsed.success) throw new Error("STT_INVALID_RESPONSE");
  if (parsed.data.result === "error")
    throw new Error(parsed.data.code ?? "STT_UNAVAILABLE");
  return parsed.data;
}
