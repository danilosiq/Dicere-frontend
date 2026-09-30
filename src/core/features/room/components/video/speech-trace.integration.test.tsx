import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const socket = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    on: vi.fn((event: string, handler: (payload: unknown) => void) => {
      const callbacks = handlers.get(event) ?? new Set();
      callbacks.add(handler);
      handlers.set(event, callbacks);
    }),
    off: vi.fn((event: string, handler: (payload: unknown) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    emitFromServer(event: string, payload: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
  };
});

vi.mock("@/core/services/socket-service", () => ({ getSocket: () => socket }));
vi.mock("@/core/services/server-speech/config", () => ({
  isServerSpeechEnabled: () => false,
}));
vi.mock("@/core/hooks/use-local-speech", () => ({
  useLocalSpeech: () => ({ captionIssue: null, retryRecognition: vi.fn() }),
}));
vi.mock("@/core/hooks/use-server-speech", () => ({
  useServerSpeech: () => ({ captionIssue: null, retryRecognition: vi.fn() }),
}));
vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "", variable: "" }),
  Roboto: () => ({ className: "", variable: "" }),
}));

import { useSpeechTranslation } from "@/core/hooks/use-speech-translation";
import {
  clearSpeechTranslationMetrics,
  getSpeechTranslationMetrics,
} from "@/core/services/speech-translation-service";
import { SubtitleCamp } from "./subtitle-camp";

function CaptionView({ roomId }: { roomId: string }) {
  const { translations, captionIssue, retryRecognition } = useSpeechTranslation(
    {
      roomId,
      language: "PT-BR",
      enabled: true,
    },
  );
  return (
    <SubtitleCamp
      captionIssue={captionIssue}
      language="PT-BR"
      translations={translations}
      onLanguageChange={() => undefined}
      retryRecognition={retryRecognition}
    />
  );
}

describe("speech trace from socket to DOM", () => {
  beforeEach(() => clearSpeechTranslationMetrics());

  it("preserves backend session and segment ids through receive and DOM insertion", () => {
    const sessionId = "a3467770-8950-43fe-b879-cae209bb1eac";
    const segmentId = `${sessionId}:0`;
    render(<CaptionView roomId="room-1" />);
    const payload = {
      roomId: "room-1",
      fromParticipantId: "participant-2",
      fromParticipantName: "Maria",
      originalText: "private speech",
      translatedText: "Traduzione",
      targetLanguage: "IT",
      traceId: sessionId,
      segmentId,
      sequence: 1,
      revision: 0,
      status: "final",
    };
    act(() => socket.emitFromServer("voice_translation_received", payload));
    act(() => socket.emitFromServer("voice_translation_received", payload));

    const subtitle = screen
      .getByLabelText("Legenda traduzida")
      .querySelector(`[data-speech-segment-id="${segmentId}"]`);
    expect(subtitle?.textContent).toContain("Traduzione");
    expect(subtitle?.outerHTML).not.toContain(payload.originalText);
    const metrics = getSpeechTranslationMetrics();
    expect(metrics.filter((metric) => metric.name === "render")).toEqual([
      expect.objectContaining({
        segmentId,
        traceId: sessionId,
        durationMs: expect.any(Number),
      }),
    ]);
    expect(metrics.filter((metric) => metric.name === "receive")).toHaveLength(
      2,
    );
    expect(JSON.stringify(metrics)).not.toContain(payload.originalText);
  });
});
