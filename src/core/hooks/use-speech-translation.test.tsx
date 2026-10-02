import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { DEEPL_TARGET_LANGUAGES } from "@/core/components/selector-country/countryList";
import { isServerSpeechLocale } from "@/core/services/server-speech/languages";
import { toSpeechRecognitionLocale } from "@/core/utils/speech-recognition-language";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  onText: null as null | ((text: string) => void),
  issue: null as null | {
    status: "blocked";
    message: string;
    retryable: boolean;
  },
  retry: vi.fn(),
  sendSpeech: vi.fn(),
  splitSpeech: vi.fn((text: string) => [text.trim()]),
  recordMetric: vi.fn(),
  onTranslation: null as null | ((payload: unknown) => void),
  onSocketError: null as null | ((message: string) => void),
  unsubscribe: vi.fn(),
  localSpeech: vi.fn(),
  serverSpeech: vi.fn(),
}));
vi.mock("./use-local-speech", () => ({
  useLocalSpeech: (options: { onText: (text: string) => void }) => {
    const { onText } = options;
    mocks.localSpeech(options);
    mocks.onText = onText;
    return { captionIssue: mocks.issue, retryRecognition: mocks.retry };
  },
}));
vi.mock("./use-server-speech", () => ({
  useServerSpeech: (options: unknown) => {
    mocks.serverSpeech(options);
    return { captionIssue: null, retryRecognition: vi.fn() };
  },
}));
vi.mock("@/core/services/speech-translation-service", () => ({
  recordSpeechTranslationMetric: mocks.recordMetric,
  sendSpeechForTranslation: mocks.sendSpeech,
  splitSpeechText: mocks.splitSpeech,
  subscribeToSpeechTranslations: ({
    onTranslation,
    onError,
  }: {
    onTranslation: (p: unknown) => void;
    onError: (m: string) => void;
  }) => {
    mocks.onTranslation = onTranslation;
    mocks.onSocketError = onError;
    return mocks.unsubscribe;
  },
}));
import { useSpeechTranslation } from "./use-speech-translation";
function renderSpeechHook() {
  return renderHook(
    ({ roomId }) =>
      useSpeechTranslation({ roomId, language: "PT-BR", enabled: true }),
    { initialProps: { roomId: "room-1" } },
  );
}
describe("useSpeechTranslation with local transcripts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.issue = null;
    mocks.sendSpeech.mockReset();
    mocks.sendSpeech.mockImplementation((payload, options) =>
      options?.onAcknowledged?.(payload),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it.each(DEEPL_TARGET_LANGUAGES)(
    "routes %s and sends text with the selected source language",
    (language) => {
      const pilot = "550e8400-e29b-41d4-a716-446655440000";
      vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", pilot);
      renderHook(() =>
        useSpeechTranslation({ roomId: pilot, language, enabled: true }),
      );
      expect(mocks.localSpeech).toHaveBeenLastCalledWith(
        expect.objectContaining({
          enabled: !isServerSpeechLocale(toSpeechRecognitionLocale(language)),
          locale: toSpeechRecognitionLocale(language),
        }),
      );
      expect(mocks.serverSpeech).toHaveBeenLastCalledWith(
        expect.objectContaining({
          enabled: isServerSpeechLocale(toSpeechRecognitionLocale(language)),
        }),
      );
      if (!isServerSpeechLocale(toSpeechRecognitionLocale(language))) {
        act(() => mocks.onText?.("Recognized text"));
        expect(mocks.sendSpeech).toHaveBeenLastCalledWith(
          expect.objectContaining({
            text: "Recognized text",
            sourceLanguage: language,
          }),
          expect.any(Object),
        );
      }
    },
  );
  it("sends each final phrase with identity, order and previous context", () => {
    renderSpeechHook();
    act(() => mocks.onText?.("Olá"));
    act(() => mocks.onText?.("Tudo bem?"));
    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    expect(mocks.sendSpeech.mock.calls[0][0]).toMatchObject({
      roomId: "room-1",
      text: "Olá",
      sourceLanguage: "PT-BR",
      sequence: 1,
      status: "final",
      revision: 1,
      segmentId: expect.any(String),
      traceId: expect.any(String),
    });
    expect(mocks.sendSpeech.mock.calls[1][0]).toMatchObject({
      text: "Tudo bem?",
      sequence: 2,
      previousContext: "Olá",
    });
  });
  it("ignores empty model output", () => {
    renderSpeechHook();
    act(() => mocks.onText?.("  "));
    expect(mocks.sendSpeech).not.toHaveBeenCalled();
  });
  it("retries transport with the same segment identity", () => {
    mocks.sendSpeech.mockImplementationOnce(() => {
      throw new Error("Socket desconectado");
    });
    renderSpeechHook();
    act(() => mocks.onText?.("Olá"));
    act(() => vi.advanceTimersByTime(1000));
    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    expect(mocks.sendSpeech.mock.calls[1][0]).toEqual(
      mocks.sendSpeech.mock.calls[0][0],
    );
  });
  it("cancels pending retries on unmount", () => {
    mocks.sendSpeech.mockImplementation(() => {
      throw new Error("offline");
    });
    const { unmount } = renderSpeechHook();
    act(() => mocks.onText?.("Olá"));
    unmount();
    act(() => vi.advanceTimersByTime(5000));
    expect(mocks.sendSpeech).toHaveBeenCalledOnce();
  });
  it("resets sequence/context and fences acknowledgements from old rooms", () => {
    mocks.sendSpeech.mockImplementation(() => undefined);
    const { rerender } = renderSpeechHook();
    act(() => mocks.onText?.("room one"));
    const [oldPayload, oldCallbacks] = mocks.sendSpeech.mock.calls[0];
    rerender({ roomId: "room-2" });
    expect(oldCallbacks.signal.aborted).toBe(true);
    act(() => mocks.onText?.("room two"));
    expect(mocks.sendSpeech.mock.calls[1][0]).toMatchObject({
      roomId: "room-2",
      sequence: 1,
    });
    expect(mocks.sendSpeech.mock.calls[1][0]).not.toHaveProperty(
      "previousContext",
    );
    act(() => oldCallbacks.onAcknowledged(oldPayload));
    expect(mocks.sendSpeech).toHaveBeenCalledTimes(2);
    expect(mocks.sendSpeech.mock.calls[1][1].signal.aborted).toBe(false);
  });
  it("aborts room-scoped work on unmount and survives StrictMode setup", () => {
    mocks.sendSpeech.mockImplementation(() => undefined);
    const { unmount } = renderHook(
      () =>
        useSpeechTranslation({
          roomId: "room-1",
          language: "PT-BR",
          enabled: true,
        }),
      { wrapper: StrictMode },
    );
    act(() => mocks.onText?.("Olá"));
    const signal = mocks.sendSpeech.mock.calls[0][1].signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });
  it("delivers an already finalized phrase after mute", () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useSpeechTranslation({ roomId: "room-1", language: "PT-BR", enabled }),
      { initialProps: { enabled: true } },
    );
    const capturedFinal = mocks.onText;
    rerender({ enabled: false });
    act(() => capturedFinal?.("Fala pronta"));
    expect(mocks.sendSpeech).toHaveBeenCalledOnce();
    expect(mocks.sendSpeech.mock.calls[0][1].signal.aborted).toBe(false);
  });
  it("preserves capture errors while translations arrive and delegates retry", () => {
    mocks.issue = {
      status: "blocked",
      message: "Modelo indisponível",
      retryable: true,
    };
    const { result } = renderSpeechHook();
    expect(result.current.captionIssue).toEqual(mocks.issue);
    act(() => result.current.retryRecognition());
    expect(mocks.retry).toHaveBeenCalledOnce();
    expect(Object.keys(result.current).sort()).toEqual([
      "captionIssue",
      "retryRecognition",
      "translations",
    ]);
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
        receivedOrder: 1,
      }),
    ]);
  });

  it("preserva ordem textual e marca a chegada tardia como a mais recente", () => {
    const { result } = renderSpeechHook();
    const received = (sequence: number, overrides = {}) => ({
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
      ...overrides,
    });
    act(() => {
      [2, 3, 4].forEach((sequence) =>
        mocks.onTranslation?.(received(sequence)),
      );
      mocks.onTranslation?.(received(1, { receivedOrder: -999 }));
    });
    expect(result.current.translations.map(({ sequence }) => sequence)).toEqual(
      [1, 2, 3, 4],
    );
    const recovered = result.current.translations[0];
    expect(recovered.receivedOrder).toBeGreaterThan(
      Math.max(
        ...result.current.translations
          .slice(1)
          .map((item) => item.receivedOrder ?? 0),
      ),
    );
    const originalOrder = recovered.receivedOrder;
    act(() => mocks.onTranslation?.(received(1)));
    expect(result.current.translations[0].receivedOrder).toBe(originalOrder);
    act(() =>
      mocks.onTranslation?.(
        received(1, { revision: 2, translatedText: "Corrigida" }),
      ),
    );
    expect(result.current.translations[0].receivedOrder).toBeGreaterThan(
      originalOrder ?? 0,
    );
  });

  it("reinicia a ordem de recepção ao trocar de sala", () => {
    const { result, rerender } = renderSpeechHook();
    const payload = {
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
    };
    act(() => {
      mocks.onTranslation?.(payload);
      mocks.onTranslation?.({
        ...payload,
        segmentId: "segment-2",
        sequence: 2,
      });
    });
    rerender({ roomId: "room-2" });
    expect(result.current.translations).toEqual([]);
    act(() => mocks.onTranslation?.({ ...payload, roomId: "room-2" }));
    expect(result.current.translations[0].receivedOrder).toBe(1);
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

  it("retém segmento antigo recuperado entre as cem chegadas mais recentes", () => {
    const { result } = renderSpeechHook();
    act(() => {
      for (let sequence = 2; sequence <= 101; sequence += 1) {
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
      mocks.onTranslation?.({
        roomId: "room-1",
        fromParticipantId: "participant-2",
        fromParticipantName: "Maria",
        originalText: "Original 1",
        translatedText: "Tradução 1",
        targetLanguage: "PT-BR",
        segmentId: "segment-1",
        sequence: 1,
        revision: 1,
        status: "final",
        traceId: "trace-1",
      });
    });
    expect(result.current.translations).toHaveLength(100);
    expect(result.current.translations[0]?.sequence).toBe(1);
    expect(
      result.current.translations.some(({ sequence }) => sequence === 2),
    ).toBe(false);
  });
});
