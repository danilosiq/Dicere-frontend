import { renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const engines = vi.hoisted(() => ({ local: vi.fn(), server: vi.fn() }));
vi.mock("./use-local-speech", () => ({ useLocalSpeech: engines.local }));
vi.mock("./use-server-speech", () => ({ useServerSpeech: engines.server }));
vi.mock("@/core/services/speech-translation-service", () => ({
  recordSpeechTranslationMetric: vi.fn(),
  sendSpeechForTranslation: vi.fn(),
  splitSpeechText: (text: string) => [text],
  subscribeToSpeechTranslations: () => () => {},
}));
import { useSpeechTranslation } from "./use-speech-translation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("selects exactly one engine and switches with the room without bypassing consent", () => {
  const pilot = "550e8400-e29b-41d4-a716-446655440000";
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", pilot);
  engines.local.mockReturnValue({
    captionIssue: null,
    retryRecognition: vi.fn(),
  });
  engines.server.mockReturnValue({
    captionIssue: null,
    retryRecognition: vi.fn(),
  });
  const view = renderHook(
    (props) => useSpeechTranslation({ ...props, language: "PT-BR" }),
    { initialProps: { roomId: pilot, enabled: false } },
  );
  expect(engines.local).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
  expect(engines.server).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
  view.rerender({ roomId: pilot, enabled: true });
  expect(engines.local).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
  expect(engines.server).toHaveBeenLastCalledWith(
    expect.objectContaining({ roomId: pilot, enabled: true }),
  );
  view.rerender({
    roomId: "550e8400-e29b-41d4-a716-446655440001",
    enabled: true,
  });
  expect(engines.local).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: true }),
  );
  expect(engines.server).toHaveBeenLastCalledWith(
    expect.objectContaining({ enabled: false }),
  );
});
