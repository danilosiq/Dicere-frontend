export type SpeechStart = {
  version: 1;
  roomId: string;
  locale: "pt-BR";
  format: "pcm_s16le";
  sampleRate: 16000;
  channels: 1;
};
export type SpeechPayload =
  | SpeechStart
  | { sessionId?: string }
  | { sessionId: string; sequence: number; audio: Uint8Array }
  | { sessionId: string; lastSequence: number };
export type SpeechAck = {
  result: "ok" | "error";
  code?: string;
  sessionId?: string;
  version?: number;
  sequence?: number;
  segments?: number;
  locale?: string;
};
export type SpeechEvent =
  | "speech_ready"
  | "speech_start"
  | "speech_chunk"
  | "speech_finish"
  | "speech_cancel";
export type SpeechEvents = Record<
  SpeechEvent,
  (payload: SpeechPayload, ack: (result: SpeechAck) => void) => void
>;
