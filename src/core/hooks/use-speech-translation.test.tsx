import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recognition: {
    transcript: "",
    finalTranscript: "",
    listening: true,
    browserSupportsSpeechRecognition: true,
  },
  startListening: vi.fn(() => Promise.resolve()),
  stopListening: vi.fn(() => Promise.resolve()),
  applyPolyfill: vi.fn(),
  nativeRecognition: {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  sendSpeech: vi.fn(({ text }: { text: string }) => [text]),
  onTranslation: null as null | ((payload: unknown) => void),
  onSocketError: null as null | ((message: string) => void),
  unsubscribe: vi.fn(),
}));

vi.mock("react-speech-recognition", () => ({
  default: {
    startListening: mocks.startListening,
    stopListening: mocks.stopListening,
    applyPolyfill: mocks.applyPolyfill,
    getRecognition: () => mocks.nativeRecognition,
  },
  useSpeechRecognition: () => mocks.recognition,
}));

vi.mock("@/core/services/speech-translation-service", () => ({
  sendSpeechForTranslation: mocks.sendSpeech,
  subscribeToSpeechTranslations: ({
    onTranslation,
    onError,
  }: {
    onTranslation: (payload: unknown) => void;
    onError: (message: string) => void;
  }) => {
    mocks.onTranslation = onTranslation;
    mocks.onSocketError = onError;
    return mocks.unsubscribe;
  },
}));

import {
  SPEECH_CONTINUOUS_FLUSH_MS,
  SPEECH_END_GRACE_MS,
  SPEECH_RETRY_BACKOFF_MS,
  SPEECH_SILENT_REARM_MS,
  SPEECH_SILENCE_TIMEOUT_MS,
  useSpeechTranslation,
} from "@/core/hooks/use-speech-translation";

type NativeEventName =
  "audiostart" | "end" | "error" | "nomatch" | "result" | "speechend" | "start";

function getNativeHandler(eventName: NativeEventName) {
  const registrations =
    mocks.nativeRecognition.addEventListener.mock.calls.filter(
      ([registeredEvent]) => registeredEvent === eventName,
    );
  return registrations.at(-1)?.[1] as ((event?: unknown) => void) | undefined;
}

function emitNative(eventName: NativeEventName, event?: unknown) {
  act(() => {
    getNativeHandler(eventName)?.(event ?? { type: eventName });
  });
}

function renderSpeechHook(initialEnabled = true) {
  return renderHook(
    ({ enabled }) =>
      useSpeechTranslation({
        roomId: "room-1",
        language: "PT-BR",
        enabled,
      }),
    { initialProps: { enabled: initialEnabled } },
  );
}

describe("useSpeechTranslation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.recognition.transcript = "";
    mocks.recognition.finalTranscript = "";
    mocks.recognition.listening = true;
    mocks.recognition.browserSupportsSpeechRecognition = true;
    mocks.startListening.mockClear();
    mocks.stopListening.mockClear();
    mocks.applyPolyfill.mockClear();
    mocks.nativeRecognition.addEventListener.mockClear();
    mocks.nativeRecognition.removeEventListener.mockClear();
    mocks.sendSpeech.mockReset();
    mocks.sendSpeech.mockImplementation(({ text }: { text: string }) => [text]);
    mocks.onTranslation = null;
    mocks.onSocketError = null;
    mocks.unsubscribe.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, "SpeechRecognition");
  });

  it("usa sessões não contínuas para controlar o rearm e o backoff", () => {
    renderSpeechHook();

    expect(mocks.startListening).toHaveBeenCalledOnce();
    expect(mocks.startListening).toHaveBeenCalledWith({
      continuous: false,
      language: "pt-BR",
    });
  });

  it("envia imediatamente um resultado final e avança o cursor sem repetir texto", () => {
    const { rerender } = renderSpeechHook();
    emitNative("start");

    mocks.recognition.transcript = "Olá";
    mocks.recognition.finalTranscript = "Olá";
    rerender({ enabled: true });

    expect(mocks.sendSpeech).toHaveBeenCalledWith({
      roomId: "room-1",
      text: "Olá",
    });

    mocks.recognition.transcript = "Olá mundo";
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(SPEECH_SILENCE_TIMEOUT_MS));
    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_END_GRACE_MS));

    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    expect(mocks.sendSpeech).toHaveBeenLastCalledWith({
      roomId: "room-1",
      text: "mundo",
    });
    expect(mocks.startListening).toHaveBeenCalledTimes(2);
  });

  it("pede finalização 150 ms depois de speechend e usa o fallback terminal", () => {
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "Trecho reconhecido";
    rerender({ enabled: true });

    emitNative("speechend");
    act(() => vi.advanceTimersByTime(SPEECH_END_GRACE_MS - 1));
    expect(mocks.sendSpeech).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.stopListening).toHaveBeenCalledOnce();
    expect(mocks.sendSpeech).not.toHaveBeenCalled();

    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_END_GRACE_MS));
    expect(mocks.sendSpeech).toHaveBeenCalledWith({
      roomId: "room-1",
      text: "Trecho reconhecido",
    });
  });

  it("usa 400 ms como fallback de silêncio", () => {
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "Pausa natural";
    rerender({ enabled: true });

    act(() => vi.advanceTimersByTime(SPEECH_SILENCE_TIMEOUT_MS - 1));
    expect(mocks.sendSpeech).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(mocks.stopListening).toHaveBeenCalledOnce();
    expect(mocks.sendSpeech).not.toHaveBeenCalled();

    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_END_GRACE_MS));
    expect(mocks.sendSpeech).toHaveBeenCalledOnce();
  });

  it("corta fala contínua depois de dois segundos", () => {
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "zero";
    rerender({ enabled: true });

    for (let elapsed = 300; elapsed < 2_000; elapsed += 300) {
      act(() => vi.advanceTimersByTime(300));
      mocks.recognition.transcript += ` ${elapsed}`;
      rerender({ enabled: true });
    }

    act(() => vi.advanceTimersByTime(SPEECH_CONTINUOUS_FLUSH_MS % 300));

    expect(mocks.stopListening).toHaveBeenCalledOnce();
    expect(mocks.sendSpeech).not.toHaveBeenCalled();

    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_END_GRACE_MS));
    expect(mocks.sendSpeech).toHaveBeenCalledOnce();
    expect(mocks.sendSpeech).toHaveBeenLastCalledWith({
      roomId: "room-1",
      text: mocks.recognition.transcript,
    });
  });

  it("mantém o issue durante a retomada e só o limpa após resultado real", () => {
    const { result } = renderSpeechHook();

    emitNative("error", { error: "network" });
    emitNative("end");

    expect(result.current.captionIssue).toEqual({
      status: "retry_wait",
      message:
        "O serviço de reconhecimento de voz está temporariamente indisponível.",
      retryable: true,
    });

    act(() => vi.advanceTimersByTime(SPEECH_RETRY_BACKOFF_MS[0]));
    emitNative("start");
    emitNative("audiostart");
    expect(result.current.captionIssue?.status).toBe("retry_wait");

    emitNative("result");
    expect(result.current.captionIssue).toBeNull();
  });

  it("aplica backoff de 1, 2, 4, 8, 16 e 30 segundos", () => {
    renderSpeechHook();
    let starts = 1;

    for (const delay of SPEECH_RETRY_BACKOFF_MS) {
      emitNative("error", { error: "network" });
      emitNative("end");

      act(() => vi.advanceTimersByTime(delay - 1));
      expect(mocks.startListening).toHaveBeenCalledTimes(starts);

      act(() => vi.advanceTimersByTime(1));
      starts += 1;
      expect(mocks.startListening).toHaveBeenCalledTimes(starts);
      emitNative("start");
    }

    emitNative("error", { error: "network" });
    emitNative("end");
    act(() => vi.advanceTimersByTime(30_000));
    expect(mocks.startListening).toHaveBeenCalledTimes(starts + 1);
  });

  it("bloqueia retry automático para erro de permissão", () => {
    const { result } = renderSpeechHook();

    emitNative("error", { error: "not-allowed" });
    emitNative("end");
    act(() => vi.advanceTimersByTime(60_000));

    expect(mocks.startListening).toHaveBeenCalledOnce();
    expect(result.current.captionIssue).toEqual({
      status: "blocked",
      message:
        "O navegador bloqueou o microfone. Libere a permissão para este site.",
      retryable: true,
    });
  });

  it.each(["no-speech", "nomatch"])(
    "rear­ma silenciosamente 250 ms depois de %s",
    (eventName) => {
      const { result } = renderSpeechHook();
      emitNative("start");

      if (eventName === "nomatch") {
        emitNative("nomatch");
      } else {
        emitNative("error", { error: eventName });
      }
      emitNative("end");

      act(() => vi.advanceTimersByTime(SPEECH_SILENT_REARM_MS - 1));
      expect(mocks.startListening).toHaveBeenCalledOnce();
      act(() => vi.advanceTimersByTime(1));

      expect(mocks.startListening).toHaveBeenCalledTimes(2);
      expect(mocks.sendSpeech).not.toHaveBeenCalled();
      expect(result.current.captionIssue).toBeNull();
    },
  );

  it("retry manual recria o reconhecedor bloqueado e inicia exatamente uma vez", () => {
    const NativeSpeechRecognition = vi.fn();
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: NativeSpeechRecognition,
    });
    const { result } = renderSpeechHook();
    emitNative("error", { error: "not-allowed" });
    emitNative("end");

    act(() => result.current.retryRecognition());
    act(() => result.current.retryRecognition());

    expect(mocks.applyPolyfill).toHaveBeenCalledOnce();
    expect(mocks.applyPolyfill).toHaveBeenCalledWith(NativeSpeechRecognition);
    expect(mocks.startListening).toHaveBeenCalledTimes(2);
    expect(mocks.startListening).toHaveBeenLastCalledWith({
      continuous: false,
      language: "pt-BR",
    });
  });

  it("cancela retry e rearm ao desativar ou desmontar", () => {
    const first = renderSpeechHook();
    emitNative("error", { error: "network" });
    emitNative("end");

    first.rerender({ enabled: false });
    emitNative("start");
    act(() => vi.advanceTimersByTime(30_000));
    expect(mocks.startListening).toHaveBeenCalledOnce();
    expect(first.result.current.captionIssue).toBeNull();
    first.unmount();

    const second = renderSpeechHook();
    emitNative("error", { error: "network" });
    emitNative("end");
    second.unmount();
    act(() => vi.advanceTimersByTime(30_000));
    expect(mocks.startListening).toHaveBeenCalledTimes(2);
  });

  it("cancela o retry de entrega ao desativar a captura", () => {
    mocks.sendSpeech.mockImplementation(() => {
      throw new Error("Socket desconectado");
    });
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "Trecho final";
    mocks.recognition.finalTranscript = "Trecho final";
    rerender({ enabled: true });

    expect(mocks.sendSpeech).toHaveBeenCalledOnce();

    rerender({ enabled: false });
    act(() => vi.advanceTimersByTime(1_000));

    expect(mocks.sendSpeech).toHaveBeenCalledOnce();
  });

  it("não inclui o interim posterior ao limite final no envio imediato", () => {
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "texto final provisório";
    mocks.recognition.finalTranscript = "texto final";

    rerender({ enabled: true });

    expect(mocks.sendSpeech).toHaveBeenCalledOnce();
    expect(mocks.sendSpeech).toHaveBeenCalledWith({
      roomId: "room-1",
      text: "texto final",
    });
  });

  it("retry de entrega reenvia somente o trecho pendente", () => {
    mocks.sendSpeech
      .mockImplementationOnce(() => {
        throw new Error("Socket desconectado");
      })
      .mockImplementationOnce(({ text }: { text: string }) => [text]);
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "final";
    mocks.recognition.finalTranscript = "final";
    rerender({ enabled: true });

    mocks.recognition.transcript = "final novo interim";
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(1_000));

    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    expect(mocks.sendSpeech).toHaveBeenLastCalledWith({
      roomId: "room-1",
      text: "final",
    });
  });

  it("mantém somente o contrato público necessário para a UI", () => {
    const { result } = renderSpeechHook();

    expect(Object.keys(result.current).sort()).toEqual([
      "captionIssue",
      "retryRecognition",
      "translations",
    ]);
  });

  it("acumula traduções recebidas sem limpar issue de captura", () => {
    const { result } = renderSpeechHook();
    emitNative("error", { error: "network" });
    const translation = {
      roomId: "room-1",
      fromParticipantId: "participant-2",
      fromParticipantName: "Maria",
      originalText: "Hello",
      translatedText: "Olá",
      targetLanguage: "PT-BR",
    };

    act(() => mocks.onTranslation?.(translation));

    expect(result.current.translations).toEqual([
      { ...translation, sequence: 1 },
    ]);
    expect(result.current.captionIssue?.status).toBe("retry_wait");
  });
});
