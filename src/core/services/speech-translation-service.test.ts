import { beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => {
  type Handler = (payload: never) => void;
  type Acknowledgement = {
    result: "ok" | "duplicate" | "error";
    segmentId?: string;
    revision?: number;
    traceId?: string;
    error?: { code: string; message: string };
  };
  type AckResult = {
    error?: Error;
    acknowledgement?: Acknowledgement;
  };

  const handlers = new Map<string, Set<Handler>>();
  const emitted: Array<{ event: string; payload: unknown }> = [];
  const ackResults: AckResult[] = [];

  const socket = {
    connected: true,
    timeout: vi.fn(() => socket),
    emit(
      event: string,
      payload: Record<string, unknown>,
      acknowledgement?: (error: Error | null, result?: Acknowledgement) => void,
    ) {
      emitted.push({ event, payload });
      if (acknowledgement) {
        const next = ackResults.shift();
        acknowledgement(
          next?.error ?? null,
          next?.acknowledgement ?? {
            result: "ok",
            segmentId: payload.segmentId as string | undefined,
            revision: payload.revision as number | undefined,
            traceId: payload.traceId as string | undefined,
          },
        );
      }
      return socket;
    },
    on(event: string, handler: Handler) {
      const listeners = handlers.get(event) ?? new Set<Handler>();
      listeners.add(handler);
      handlers.set(event, listeners);
      return socket;
    },
    off(event: string, handler: Handler) {
      handlers.get(event)?.delete(handler);
      return socket;
    },
  };

  return {
    socket,
    emitted,
    ackResults,
    reset() {
      handlers.clear();
      emitted.length = 0;
      ackResults.length = 0;
      socket.connected = true;
      socket.timeout.mockClear();
    },
    serverEmit(event: string, payload: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload as never));
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
  };
});

vi.mock("./socket-service", () => ({
  getSocket: () => socketMock.socket,
}));

import {
  clearSpeechTranslationMetrics,
  getSpeechTranslationMetrics,
  MAX_SPEECH_TRANSLATION_CHARACTERS,
  recordSpeechTranslationMetric,
  sendSpeechForTranslation,
  SPEECH_TRANSLATION_ACK_TIMEOUT_MS,
  SPEECH_TRANSLATION_METRICS_LIMIT,
  SpeechTranslationConnectionError,
  subscribeToSpeechTranslations,
} from "./speech-translation-service";

describe("speech-translation-service", () => {
  beforeEach(() => {
    socketMock.reset();
    clearSpeechTranslationMetrics();
  });

  it("preserva metadados e confirma a entrega versionada", () => {
    const onAcknowledged = vi.fn();
    const payload = {
      roomId: " room-1 ",
      text: "  Olá, tudo bem?  ",
      segmentId: "segment-1",
      sequence: 4,
      revision: 1,
      status: "final" as const,
      traceId: "trace-1",
      clientSentAt: 123,
      sourceLanguage: "PT-BR",
      previousContext: "Bom dia",
    };

    const chunks = sendSpeechForTranslation(payload, { onAcknowledged });

    expect(chunks).toEqual(["Olá, tudo bem?"]);
    expect(socketMock.socket.timeout).toHaveBeenCalledWith(
      SPEECH_TRANSLATION_ACK_TIMEOUT_MS,
    );
    expect(socketMock.emitted).toEqual([
      {
        event: "translate_speech",
        payload: { ...payload, roomId: "room-1", text: "Olá, tudo bem?" },
      },
    ]);
    expect(onAcknowledged).toHaveBeenCalledWith(
      { ...payload, roomId: "room-1", text: "Olá, tudo bem?" },
      expect.objectContaining({ result: "ok", segmentId: "segment-1" }),
    );
  });

  it("divide textos longos e cria identidade própria para cada chunk", () => {
    const text = `${"palavra ".repeat(40)}fim`;
    const chunks = sendSpeechForTranslation({
      roomId: "room-1",
      text,
      segmentId: "segment",
      sequence: 10,
      traceId: "trace",
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every(
        (chunk) => chunk.length <= MAX_SPEECH_TRANSLATION_CHARACTERS,
      ),
    ).toBe(true);
    expect(chunks.join(" ")).toBe(text.trim().replace(/\s+/g, " "));
    expect(socketMock.emitted[0]?.payload).toEqual(
      expect.objectContaining({
        segmentId: "segment:1",
        sequence: 10,
        traceId: "trace:1",
      }),
    );
    expect(socketMock.emitted[1]?.payload).toEqual(
      expect.objectContaining({
        segmentId: "segment:2",
        sequence: 11,
        traceId: "trace:2",
      }),
    );
  });

  it("repete duas vezes com a mesma identidade quando o ack expira", () => {
    socketMock.ackResults.push(
      { error: new Error("timeout") },
      { error: new Error("timeout") },
      { error: new Error("timeout") },
    );
    const onTerminalError = vi.fn();

    sendSpeechForTranslation(
      {
        roomId: "room-1",
        text: "Olá",
        segmentId: "segment-1",
        revision: 2,
        traceId: "trace-1",
      },
      { onTerminalError },
    );

    expect(socketMock.emitted).toHaveLength(3);
    expect(socketMock.emitted.map(({ payload }) => payload)).toEqual([
      expect.objectContaining({ segmentId: "segment-1", revision: 2 }),
      expect.objectContaining({ segmentId: "segment-1", revision: 2 }),
      expect.objectContaining({ segmentId: "segment-1", revision: 2 }),
    ]);
    expect(onTerminalError).toHaveBeenCalledWith(
      expect.objectContaining({ segmentId: "segment-1" }),
      expect.objectContaining({ kind: "timeout", retryable: true }),
    );
    expect(getSpeechTranslationMetrics().at(-1)?.name).toBe("ack_timeout");
  });

  it("propaga erro definitivo retornado pelo servidor", () => {
    socketMock.ackResults.push({
      acknowledgement: {
        result: "error",
        error: { code: "INVALID_PAYLOAD", message: "Payload inválido" },
      },
    });
    const onTerminalError = vi.fn();

    sendSpeechForTranslation(
      { roomId: "room-1", text: "Olá", segmentId: "segment-1" },
      { onTerminalError },
    );

    expect(onTerminalError).toHaveBeenCalledWith(
      expect.objectContaining({ segmentId: "segment-1" }),
      {
        kind: "server",
        message: "Payload inválido",
        retryable: false,
      },
    );
  });

  it("mantém o texto no cliente quando o socket está desconectado", () => {
    socketMock.socket.connected = false;

    expect(() =>
      sendSpeechForTranslation({ roomId: "room-1", text: "Olá" }),
    ).toThrow(SpeechTranslationConnectionError);
    expect(socketMock.emitted).toHaveLength(0);
  });

  it("recebe contratos legados e versionados e remove os listeners", () => {
    const onTranslation = vi.fn();
    const onError = vi.fn();
    const unsubscribe = subscribeToSpeechTranslations({
      onTranslation,
      onError,
    });
    const translation = {
      roomId: "room-1",
      fromParticipantId: "participant-2",
      fromParticipantName: "Maria",
      originalText: "Hello",
      translatedText: "Olá",
      targetLanguage: "PT-BR",
      segmentId: "segment-1",
      sequence: 1,
      revision: 1,
      status: "final",
      traceId: "trace-1",
      clientSentAt: new Date().toISOString(),
      sourceLanguage: "EN",
      timings: { processingMs: 12 },
    };

    socketMock.serverEmit("voice_translation_received", translation);
    socketMock.serverEmit("voice_translation_received", {
      ...translation,
      segmentId: undefined,
      sequence: undefined,
      revision: undefined,
      status: undefined,
      traceId: undefined,
    });
    socketMock.serverEmit("error", {
      event: "translate_speech",
      code: "TRANSLATION_FAILED",
      message: "Erro ao traduzir fala",
    });
    socketMock.serverEmit("error", {
      event: "join-call",
      code: "CALL_FULL",
      message: "Chamada cheia",
    });

    expect(onTranslation).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("Erro ao traduzir fala");
    expect(getSpeechTranslationMetrics()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "receive",
          segmentId: "segment-1",
        }),
      ]),
    );

    unsubscribe();
    expect(socketMock.listenerCount("voice_translation_received")).toBe(0);
    expect(socketMock.listenerCount("error")).toBe(0);
  });

  it("rejeita metadados versionados inválidos", () => {
    const onTranslation = vi.fn();
    const onError = vi.fn();
    subscribeToSpeechTranslations({ onTranslation, onError });

    socketMock.serverEmit("voice_translation_received", {
      roomId: "room-1",
      fromParticipantId: "participant-2",
      fromParticipantName: "Maria",
      originalText: "Hello",
      translatedText: "Olá",
      targetLanguage: "PT-BR",
      sequence: -1,
    });

    expect(onTranslation).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      "O servidor retornou uma legenda inválida.",
    );
  });

  it("limita e protege o buffer local de métricas", () => {
    for (
      let index = 0;
      index < SPEECH_TRANSLATION_METRICS_LIMIT + 5;
      index += 1
    ) {
      recordSpeechTranslationMetric({
        name: "receive",
        observedAt: index,
        segmentId: `segment-${index}`,
        timings: { processingMs: index },
      });
    }

    const metrics = getSpeechTranslationMetrics();
    expect(metrics).toHaveLength(SPEECH_TRANSLATION_METRICS_LIMIT);
    expect(metrics[0]?.segmentId).toBe("segment-5");

    if (metrics[0]?.timings) {
      metrics[0].timings.processingMs = 999;
    }
    expect(getSpeechTranslationMetrics()[0]?.timings?.processingMs).toBe(5);
  });
});
