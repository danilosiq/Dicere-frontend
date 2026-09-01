import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  recognition: {
    transcript: "",
    interimTranscript: "",
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
  sendSpeech: vi.fn(),
  splitSpeech: vi.fn((text: string) => [text.trim()]),
  recordMetric: vi.fn(),
  reportDiagnostic: vi.fn(() => Promise.resolve()),
  activateOnDevice: vi.fn(
    (): Promise<{
      status:
        "activated" | "downloading" | "failed" | "unavailable" | "unsupported";
      errorName?: string;
    }> => Promise.resolve({ status: "unsupported" }),
  ),
  restoreRemote: vi.fn(() => true),
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
  recordSpeechTranslationMetric: mocks.recordMetric,
  sendSpeechForTranslation: mocks.sendSpeech,
  splitSpeechText: mocks.splitSpeech,
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

vi.mock("@/core/services/speech-recognition-service", () => ({
  activateOnDeviceSpeechRecognition: mocks.activateOnDevice,
  reportSpeechRecognitionDiagnostic: mocks.reportDiagnostic,
  restoreRemoteSpeechRecognition: mocks.restoreRemote,
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
  | "audiostart"
  | "end"
  | "error"
  | "nomatch"
  | "result"
  | "speechend"
  | "speechstart"
  | "start";

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
    mocks.recognition.interimTranscript = "";
    mocks.recognition.finalTranscript = "";
    mocks.recognition.listening = true;
    mocks.recognition.browserSupportsSpeechRecognition = true;
    mocks.startListening.mockClear();
    mocks.stopListening.mockClear();
    mocks.applyPolyfill.mockClear();
    mocks.nativeRecognition.addEventListener.mockClear();
    mocks.nativeRecognition.removeEventListener.mockClear();
    mocks.sendSpeech.mockReset();
    mocks.sendSpeech.mockImplementation(
      (
        payload: {
          text: string;
          segmentId?: string;
          revision?: number;
          traceId?: string;
        },
        options?: {
          onAcknowledged?: (payload: unknown, acknowledgement: unknown) => void;
        },
      ) => {
        options?.onAcknowledged?.(payload, {
          result: "ok",
          segmentId: payload.segmentId,
          revision: payload.revision,
          traceId: payload.traceId,
        });
        return [payload.text];
      },
    );
    mocks.splitSpeech.mockClear();
    mocks.splitSpeech.mockImplementation((text: string) => [text.trim()]);
    mocks.recordMetric.mockClear();
    mocks.reportDiagnostic.mockClear();
    mocks.activateOnDevice.mockClear();
    mocks.activateOnDevice.mockResolvedValue({ status: "unsupported" });
    mocks.restoreRemote.mockClear();
    mocks.restoreRemote.mockReturnValue(true);
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

    expect(mocks.sendSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-1",
        text: "Olá",
        segmentId: expect.any(String),
        sequence: 1,
        revision: 1,
        status: "final",
        traceId: expect.any(String),
        clientSentAt: expect.any(Number),
        sourceLanguage: "PT-BR",
      }),
      expect.any(Object),
    );

    mocks.recognition.transcript = "Olá mundo";
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(SPEECH_SILENCE_TIMEOUT_MS));
    mocks.recognition.finalTranscript = "Olá mundo";
    rerender({ enabled: true });
    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_END_GRACE_MS));

    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    expect(mocks.sendSpeech).toHaveBeenLastCalledWith(
      expect.objectContaining({
        roomId: "room-1",
        text: "mundo",
        sequence: 2,
        previousContext: "Olá",
      }),
      expect.any(Object),
    );
    expect(mocks.startListening).toHaveBeenCalledTimes(2);
  });

  it("pede finalização 150 ms depois de speechend sem promover interim", () => {
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
    expect(mocks.sendSpeech).not.toHaveBeenCalled();
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
    expect(mocks.sendSpeech).not.toHaveBeenCalled();
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
    expect(mocks.sendSpeech).not.toHaveBeenCalled();
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

  it("registra o erro nativo com locale, tentativa e modo do reconhecedor", () => {
    renderSpeechHook();

    emitNative("error", { error: "network" });

    expect(mocks.reportDiagnostic).toHaveBeenCalledWith({
      code: "network",
      locale: "pt-BR",
      mode: "remote",
      retryAttempt: 1,
      stage: "runtime",
    });
  });

  it("tenta ativar o fallback local após a segunda falha de rede", async () => {
    mocks.activateOnDevice.mockResolvedValue({ status: "activated" });
    renderSpeechHook();

    emitNative("error", { error: "network" });
    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_RETRY_BACKOFF_MS[0]));
    emitNative("start");
    emitNative("error", { error: "network" });

    await act(async () => Promise.resolve());

    expect(mocks.activateOnDevice).toHaveBeenCalledWith("pt-BR");
    expect(mocks.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "local-fallback-activated",
        mode: "on-device",
        stage: "fallback",
      }),
    );
  });

  it.each(["service-not-allowed", "language-not-supported"])(
    "tenta fallback local imediatamente após %s",
    async (error) => {
      mocks.activateOnDevice.mockResolvedValue({ status: "activated" });
      renderSpeechHook();

      emitNative("error", { error });
      await act(async () => Promise.resolve());

      expect(mocks.activateOnDevice).toHaveBeenCalledWith("pt-BR");
      expect(mocks.startListening).toHaveBeenCalledTimes(2);
    },
  );

  it("retry manual tenta novamente o fallback local após falhas de rede repetidas", async () => {
    mocks.activateOnDevice
      .mockResolvedValueOnce({ status: "failed" })
      .mockResolvedValueOnce({ status: "activated" });
    const { result } = renderSpeechHook();

    emitNative("error", { error: "network" });
    emitNative("end");
    act(() => vi.advanceTimersByTime(SPEECH_RETRY_BACKOFF_MS[0]));
    emitNative("start");
    emitNative("error", { error: "network" });
    await act(async () => Promise.resolve());

    act(() => result.current.retryRecognition());
    await act(async () => Promise.resolve());

    expect(mocks.activateOnDevice).toHaveBeenCalledTimes(2);
    expect(mocks.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({ code: "local-fallback-activated" }),
    );
  });

  it("retoma imediatamente quando a conexão do navegador volta", () => {
    renderSpeechHook();
    emitNative("error", { error: "network" });
    emitNative("end");

    act(() => window.dispatchEvent(new Event("online")));

    expect(mocks.startListening).toHaveBeenCalledTimes(2);
    act(() => vi.advanceTimersByTime(SPEECH_RETRY_BACKOFF_MS[0]));
    expect(mocks.startListening).toHaveBeenCalledTimes(2);
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

  it("oferece fallback local manual quando o navegador não expõe reconhecimento remoto", async () => {
    mocks.recognition.browserSupportsSpeechRecognition = false;
    mocks.activateOnDevice.mockResolvedValue({ status: "activated" });
    const { result } = renderSpeechHook();

    act(() => result.current.retryRecognition());
    await act(async () => Promise.resolve());

    expect(mocks.activateOnDevice).toHaveBeenCalledWith("pt-BR");
    expect(mocks.reportDiagnostic).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "local-fallback-activated",
        mode: "on-device",
      }),
    );
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
    expect(mocks.sendSpeech).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-1",
        text: "texto final",
        status: "final",
      }),
      expect.any(Object),
    );
  });

  it("retry de entrega reenvia somente o trecho pendente", () => {
    mocks.sendSpeech.mockImplementationOnce(() => {
      throw new Error("Socket desconectado");
    });
    const { rerender } = renderSpeechHook();
    emitNative("start");
    mocks.recognition.transcript = "final";
    mocks.recognition.finalTranscript = "final";
    rerender({ enabled: true });

    mocks.recognition.transcript = "final novo interim";
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(1_000));

    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    const firstPayload = mocks.sendSpeech.mock.calls[0]?.[0];
    const retriedPayload = mocks.sendSpeech.mock.calls[1]?.[0];
    expect(retriedPayload).toEqual(firstPayload);
  });

  it("substitui revisões do mesmo segmento e ordena por sequence", () => {
    const { result } = renderSpeechHook();
    const baseTranslation = {
      roomId: "room-1",
      fromParticipantId: "participant-2",
      fromParticipantName: "Maria",
      originalText: "Hello",
      targetLanguage: "PT-BR",
      sourceLanguage: "EN",
    };

    act(() => {
      mocks.onTranslation?.({
        ...baseTranslation,
        translatedText: "Mundo provisório",
        segmentId: "segment-2",
        sequence: 2,
        revision: 1,
        status: "provisional",
        traceId: "trace-2",
      });
      mocks.onTranslation?.({
        ...baseTranslation,
        translatedText: "Olá",
        segmentId: "segment-1",
        sequence: 1,
        revision: 1,
        status: "final",
        traceId: "trace-1",
      });
      mocks.onTranslation?.({
        ...baseTranslation,
        translatedText: "Mundo final",
        segmentId: "segment-2",
        sequence: 2,
        revision: 2,
        status: "final",
        traceId: "trace-2",
      });
    });

    expect(result.current.translations).toEqual([
      expect.objectContaining({
        segmentId: "segment-1",
        sequence: 1,
        translatedText: "Olá",
      }),
      expect.objectContaining({
        segmentId: "segment-2",
        sequence: 2,
        revision: 2,
        status: "final",
        translatedText: "Mundo final",
      }),
    ]);
  });

  it("ignora duplicatas, revisões antigas e reabertura de segmento final", () => {
    const { result } = renderSpeechHook();
    const finalTranslation = {
      roomId: "room-1",
      fromParticipantId: "participant-2",
      fromParticipantName: "Maria",
      originalText: "Hello",
      translatedText: "Final",
      targetLanguage: "PT-BR",
      segmentId: "segment-1",
      sequence: 1,
      revision: 2,
      status: "final",
      traceId: "trace-1",
    };

    act(() => {
      mocks.onTranslation?.(finalTranslation);
      mocks.onTranslation?.(finalTranslation);
      mocks.onTranslation?.({
        ...finalTranslation,
        translatedText: "Antiga",
        revision: 1,
      });
      mocks.onTranslation?.({
        ...finalTranslation,
        translatedText: "Provisória",
        revision: 3,
        status: "provisional",
      });
    });

    expect(result.current.translations).toEqual([
      expect.objectContaining({
        translatedText: "Final",
        revision: 2,
        status: "final",
      }),
    ]);
  });

  it("limita o histórico recebido a cem segmentos", () => {
    const { result } = renderSpeechHook();

    act(() => {
      for (let sequence = 1; sequence <= 105; sequence += 1) {
        mocks.onTranslation?.({
          roomId: "room-1",
          fromParticipantId: "participant-2",
          fromParticipantName: "Maria",
          originalText: `Original ${sequence}`,
          translatedText: `Tradução ${sequence}`,
          targetLanguage: "PT-BR",
          segmentId: `segment-${sequence}`,
          sequence,
          revision: 1,
          status: "final",
          traceId: `trace-${sequence}`,
        });
      }
    });

    expect(result.current.translations).toHaveLength(100);
    expect(result.current.translations[0]?.sequence).toBe(6);
    expect(result.current.translations.at(-1)?.sequence).toBe(105);
  });

  it("reinicia histórico, sequências e contexto ao trocar de sala", () => {
    const { result, rerender } = renderHook(
      ({ roomId }) =>
        useSpeechTranslation({
          roomId,
          language: "PT-BR",
          enabled: true,
        }),
      { initialProps: { roomId: "room-1" } },
    );

    act(() =>
      mocks.onTranslation?.({
        roomId: "room-1",
        fromParticipantId: "participant-2",
        fromParticipantName: "Maria",
        originalText: "Hello",
        translatedText: "Olá",
        targetLanguage: "PT-BR",
      }),
    );
    expect(result.current.translations).toHaveLength(1);

    rerender({ roomId: "room-2" });

    expect(result.current.translations).toEqual([]);
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });

  it("mede primeiro interim, primeiro final, segmentação e commit", () => {
    const { rerender } = renderSpeechHook();
    emitNative("start");
    emitNative("speechstart");

    act(() => vi.advanceTimersByTime(25));
    mocks.recognition.interimTranscript = "Olá";
    mocks.recognition.transcript = "Olá";
    rerender({ enabled: true });

    act(() => vi.advanceTimersByTime(25));
    mocks.recognition.interimTranscript = "";
    mocks.recognition.finalTranscript = "Olá";
    rerender({ enabled: true });

    act(() =>
      mocks.onTranslation?.({
        roomId: "room-1",
        fromParticipantId: "participant-2",
        fromParticipantName: "Maria",
        originalText: "Hello",
        translatedText: "Olá",
        targetLanguage: "PT-BR",
        segmentId: "received-1",
        sequence: 1,
        revision: 1,
        status: "final",
        traceId: "received-trace-1",
      }),
    );

    expect(mocks.recordMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "recognition_first_interim",
        durationMs: expect.any(Number),
      }),
    );
    expect(mocks.recordMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "recognition_first_final",
        durationMs: expect.any(Number),
      }),
    );
    expect(mocks.recordMetric).toHaveBeenCalledWith(
      expect.objectContaining({ name: "segment_ready" }),
    );
    expect(mocks.recordMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "commit",
        segmentId: "received-1",
      }),
    );
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
      expect.objectContaining({
        ...translation,
        segmentId: "legacy-1",
        sequence: 1,
        revision: 1,
        status: "final",
        traceId: "legacy-1",
      }),
    ]);
    expect(result.current.captionIssue?.status).toBe("retry_wait");
  });
});
