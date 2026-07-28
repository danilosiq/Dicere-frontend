import { beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => {
  type Handler = (payload: never) => void;
  const handlers = new Map<string, Set<Handler>>();
  const emitted: Array<{ event: string; payload: unknown }> = [];

  const socket = {
    connected: true,
    emit(event: string, payload: unknown) {
      emitted.push({ event, payload });
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
    reset() {
      handlers.clear();
      emitted.length = 0;
      socket.connected = true;
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
  MAX_SPEECH_TRANSLATION_CHARACTERS,
  sendSpeechForTranslation,
  SpeechTranslationConnectionError,
  splitSpeechText,
  subscribeToSpeechTranslations,
} from "./speech-translation-service";

describe("speech-translation-service", () => {
  beforeEach(() => socketMock.reset());

  it("envia somente o trecho informado pelo contrato do backend", () => {
    const chunks = sendSpeechForTranslation({
      roomId: " room-1 ",
      text: "  Olá, tudo bem?  ",
    });

    expect(chunks).toEqual(["Olá, tudo bem?"]);
    expect(socketMock.emitted).toEqual([
      {
        event: "translate_speech",
        payload: { roomId: "room-1", text: "Olá, tudo bem?" },
      },
    ]);
  });

  it("divide textos acima do limite sem perder palavras", () => {
    const text = `${"palavra ".repeat(40)}fim`;
    const chunks = splitSpeechText(text);

    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.every(
        (chunk) => chunk.length <= MAX_SPEECH_TRANSLATION_CHARACTERS,
      ),
    ).toBe(true);
    expect(chunks.join(" ")).toBe(text.trim().replace(/\s+/g, " "));
  });

  it("mantém o texto no cliente quando o socket está desconectado", () => {
    socketMock.socket.connected = false;

    expect(() =>
      sendSpeechForTranslation({ roomId: "room-1", text: "Olá" }),
    ).toThrow(SpeechTranslationConnectionError);
    expect(socketMock.emitted).toHaveLength(0);
  });

  it("recebe traduções, trata erros do fluxo e remove listeners", () => {
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
    };

    socketMock.serverEmit("voice_translation_received", translation);
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
    socketMock.serverEmit("error", {
      message: "Erro sem identificação de fluxo",
    });

    expect(onTranslation).toHaveBeenCalledWith(translation);
    expect(onError).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith("Erro ao traduzir fala");

    unsubscribe();
    expect(socketMock.listenerCount("voice_translation_received")).toBe(0);
    expect(socketMock.listenerCount("error")).toBe(0);
  });
});
