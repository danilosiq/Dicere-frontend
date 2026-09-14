import { act, renderHook } from "@testing-library/react";
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
}));
vi.mock("./use-local-speech", () => ({
  useLocalSpeech: ({ onText }: { onText: (text: string) => void }) => {
    mocks.onText = onText;
    return { captionIssue: mocks.issue, retryRecognition: mocks.retry };
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
  afterEach(() => vi.useRealTimers());
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
});
