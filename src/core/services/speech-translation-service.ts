import type {
  SpeechSegmentStatus,
  SpeechTranslationTimings,
  SocketEventErrorPayload,
  TranslateSpeechAcknowledgement,
  TranslateSpeechPayload,
  VoiceTranslationReceivedPayload,
} from "@/core/@types/socket-events";
import { getSocket } from "@/core/services/socket-service";

export const MAX_SPEECH_TRANSLATION_CHARACTERS = 250;
export const SPEECH_TRANSLATION_ACK_TIMEOUT_MS = 8_000;
export const SPEECH_TRANSLATION_MAX_RETRIES = 2;
export const SPEECH_TRANSLATION_METRICS_LIMIT = 100;

export type SpeechTranslationLocalMetric = {
  name:
    | "ack"
    | "ack_timeout"
    | "commit"
    | "emit"
    | "receive"
    | "recognition_first_interim"
    | "recognition_first_final"
    | "segment_ready";
  observedAt: number;
  segmentId?: string;
  traceId?: string;
  attempt?: number;
  durationMs?: number;
  result?: TranslateSpeechAcknowledgement["result"] | "timeout";
  timings?: SpeechTranslationTimings;
};

const localMetrics: SpeechTranslationLocalMetric[] = [];

function getMonotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}

function logSpeechTranslationFailure(
  level: "error" | "warn",
  payload: TranslateSpeechPayload,
  details: {
    attempt?: number;
    code: string;
    retryable: boolean;
  },
) {
  console[level]("[Dicere][SpeechTranslation]", {
    ...details,
    occurredAt: new Date().toISOString(),
    ...(payload.segmentId ? { segmentId: payload.segmentId } : {}),
    ...(payload.revision !== undefined ? { revision: payload.revision } : {}),
    ...(payload.traceId ? { traceId: payload.traceId } : {}),
  });
}

export function recordSpeechTranslationMetric(
  metric: SpeechTranslationLocalMetric,
) {
  localMetrics.push(metric);

  if (localMetrics.length > SPEECH_TRANSLATION_METRICS_LIMIT) {
    localMetrics.splice(
      0,
      localMetrics.length - SPEECH_TRANSLATION_METRICS_LIMIT,
    );
  }
}

export function getSpeechTranslationMetrics() {
  return localMetrics.map((metric) => ({
    ...metric,
    timings: metric.timings ? { ...metric.timings } : undefined,
  }));
}

export function clearSpeechTranslationMetrics() {
  localMetrics.length = 0;
}

export class SpeechTranslationConnectionError extends Error {
  constructor() {
    super("A conexão com a tradução foi interrompida.");
    this.name = "SpeechTranslationConnectionError";
  }
}

export type SpeechTranslationDeliveryFailure = {
  kind: "server" | "timeout";
  message: string;
  retryable: boolean;
};

export type SpeechTranslationDeliveryOptions = {
  onAcknowledged?: (
    payload: TranslateSpeechPayload,
    acknowledgement: TranslateSpeechAcknowledgement,
  ) => void;
  onTerminalError?: (
    payload: TranslateSpeechPayload,
    failure: SpeechTranslationDeliveryFailure,
  ) => void;
};

function splitLongWord(word: string) {
  const chunks: string[] = [];

  for (
    let start = 0;
    start < word.length;
    start += MAX_SPEECH_TRANSLATION_CHARACTERS
  ) {
    chunks.push(word.slice(start, start + MAX_SPEECH_TRANSLATION_CHARACTERS));
  }

  return chunks;
}

export function splitSpeechText(text: string) {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  if (!normalizedText) return [];

  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of normalizedText.split(" ")) {
    if (word.length > MAX_SPEECH_TRANSLATION_CHARACTERS) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      chunks.push(...splitLongWord(word));
      continue;
    }

    const candidate = currentChunk ? `${currentChunk} ${word}` : word;

    if (candidate.length <= MAX_SPEECH_TRANSLATION_CHARACTERS) {
      currentChunk = candidate;
      continue;
    }

    chunks.push(currentChunk);
    currentChunk = word;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function createChunkPayload(
  payload: TranslateSpeechPayload,
  text: string,
  chunkIndex: number,
  chunkCount: number,
): TranslateSpeechPayload {
  const hasMultipleChunks = chunkCount > 1;
  const chunkPayload: TranslateSpeechPayload = {
    ...payload,
    roomId: payload.roomId.trim(),
    text,
  };

  if (hasMultipleChunks && payload.segmentId) {
    chunkPayload.segmentId = `${payload.segmentId}:${chunkIndex + 1}`;
  }
  if (payload.sequence !== undefined) {
    chunkPayload.sequence = payload.sequence + chunkIndex;
  }
  if (hasMultipleChunks && payload.traceId) {
    chunkPayload.traceId = `${payload.traceId}:${chunkIndex + 1}`;
  }

  return chunkPayload;
}

function emitSpeechChunk(
  payload: TranslateSpeechPayload,
  options: SpeechTranslationDeliveryOptions,
  attempt = 0,
): void {
  const socket = getSocket();
  const emittedAt = getMonotonicNow();

  recordSpeechTranslationMetric({
    name: "emit",
    observedAt: emittedAt,
    segmentId: payload.segmentId,
    traceId: payload.traceId,
    attempt: attempt + 1,
  });

  socket
    .timeout(SPEECH_TRANSLATION_ACK_TIMEOUT_MS)
    .emit("translate_speech", payload, (error, acknowledgement) => {
      if (error) {
        if (attempt < SPEECH_TRANSLATION_MAX_RETRIES) {
          emitSpeechChunk(payload, options, attempt + 1);
          return;
        }

        const timedOutAt = getMonotonicNow();
        recordSpeechTranslationMetric({
          name: "ack_timeout",
          observedAt: timedOutAt,
          segmentId: payload.segmentId,
          traceId: payload.traceId,
          durationMs: timedOutAt - emittedAt,
          result: "timeout",
        });
        logSpeechTranslationFailure("warn", payload, {
          attempt: attempt + 1,
          code: "ACK_TIMEOUT",
          retryable: true,
        });
        options.onTerminalError?.(payload, {
          kind: "timeout",
          message:
            "O servidor não confirmou o recebimento deste trecho a tempo.",
          retryable: true,
        });
        return;
      }

      const acknowledgedAt = getMonotonicNow();
      recordSpeechTranslationMetric({
        name: "ack",
        observedAt: acknowledgedAt,
        segmentId: acknowledgement?.segmentId ?? payload.segmentId,
        traceId: acknowledgement?.traceId ?? payload.traceId,
        durationMs: acknowledgedAt - emittedAt,
        result: acknowledgement?.result,
        timings: acknowledgement?.timings,
      });

      if (acknowledgement?.result === "error") {
        logSpeechTranslationFailure("error", payload, {
          code: acknowledgement.error?.code ?? "SERVER_REJECTED",
          retryable: false,
        });
        options.onTerminalError?.(payload, {
          kind: "server",
          message:
            acknowledgement.error?.message ??
            "O servidor não aceitou este trecho para tradução.",
          retryable: false,
        });
        return;
      }

      if (acknowledgement) {
        options.onAcknowledged?.(payload, acknowledgement);
      }
    });
}

export function sendSpeechForTranslation(
  payload: TranslateSpeechPayload,
  options: SpeechTranslationDeliveryOptions = {},
) {
  const socket = getSocket();

  if (!socket.connected) {
    logSpeechTranslationFailure("warn", payload, {
      code: "SOCKET_DISCONNECTED",
      retryable: true,
    });
    throw new SpeechTranslationConnectionError();
  }

  const chunks = splitSpeechText(payload.text);

  chunks.forEach((text, chunkIndex) => {
    emitSpeechChunk(
      createChunkPayload(payload, text, chunkIndex, chunks.length),
      options,
    );
  });

  return chunks;
}

function isOptionalString(value: unknown) {
  return value === undefined || typeof value === "string";
}

function isOptionalFiniteNumber(value: unknown) {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value))
  );
}

function isOptionalClientTimestamp(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "string" && Number.isFinite(Date.parse(value))) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isOptionalNonNegativeInteger(value: unknown) {
  return (
    value === undefined ||
    (typeof value === "number" && Number.isInteger(value) && value >= 0)
  );
}

function isOptionalSegmentStatus(
  value: unknown,
): value is SpeechSegmentStatus | undefined {
  return value === undefined || value === "provisional" || value === "final";
}

function isOptionalTimings(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== "object") return false;

  const timings = value as Partial<SpeechTranslationTimings>;

  return (
    isOptionalFiniteNumber(timings.queueWaitMs) &&
    isOptionalFiniteNumber(timings.processingMs) &&
    isOptionalFiniteNumber(timings.translationDurationMs)
  );
}

function isVoiceTranslationPayload(
  payload: unknown,
): payload is VoiceTranslationReceivedPayload {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Partial<VoiceTranslationReceivedPayload>;

  return (
    typeof candidate.roomId === "string" &&
    typeof candidate.fromParticipantId === "string" &&
    typeof candidate.fromParticipantName === "string" &&
    typeof candidate.originalText === "string" &&
    typeof candidate.translatedText === "string" &&
    typeof candidate.targetLanguage === "string" &&
    isOptionalString(candidate.segmentId) &&
    isOptionalNonNegativeInteger(candidate.sequence) &&
    isOptionalNonNegativeInteger(candidate.revision) &&
    isOptionalSegmentStatus(candidate.status) &&
    isOptionalString(candidate.traceId) &&
    isOptionalClientTimestamp(candidate.clientSentAt) &&
    isOptionalString(candidate.sourceLanguage) &&
    isOptionalString(candidate.previousContext) &&
    isOptionalFiniteNumber(candidate.serverSentAt) &&
    isOptionalTimings(candidate.timings)
  );
}

type SpeechTranslationSubscription = {
  onTranslation: (payload: VoiceTranslationReceivedPayload) => void;
  onError: (message: string) => void;
};

export function subscribeToSpeechTranslations({
  onTranslation,
  onError,
}: SpeechTranslationSubscription) {
  const socket = getSocket();

  const handleTranslation = (payload: VoiceTranslationReceivedPayload) => {
    if (!isVoiceTranslationPayload(payload)) {
      onError("O servidor retornou uma legenda inválida.");
      return;
    }

    recordSpeechTranslationMetric({
      name: "receive",
      observedAt: getMonotonicNow(),
      segmentId: payload.segmentId,
      traceId: payload.traceId,
      timings: payload.timings,
    });
    onTranslation(payload);
  };

  const handleError = (payload: SocketEventErrorPayload) => {
    if (!payload || payload.event !== "translate_speech") return;
    onError(payload.message || "Não foi possível traduzir este trecho.");
  };

  socket.on("voice_translation_received", handleTranslation);
  socket.on("error", handleError);

  return () => {
    socket.off("voice_translation_received", handleTranslation);
    socket.off("error", handleError);
  };
}
