import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LocalSpeechFailure,
  LocalSpeechStage,
} from "@/core/services/local-speech-engine";

type Options = {
  locale: string;
  onStage: (stage: LocalSpeechStage) => void;
  onText: (text: string) => void;
  onError: (failure: LocalSpeechFailure) => void;
};
const mocks = vi.hoisted(() => ({
  sessions: [] as { options: Options; stop: ReturnType<typeof vi.fn> }[],
  report: vi.fn(),
}));
vi.mock("@/core/services/local-speech-engine", () => ({
  LocalSpeechEngine: class {
    stop = vi.fn();
    constructor(public options: Options) {
      mocks.sessions.push(this);
    }
    async start() {
      this.options.onStage("loading");
    }
  },
}));
vi.mock("@/core/services/speech-recognition-service", () => ({
  reportSpeechRecognitionDiagnostic: mocks.report,
}));
import { useLocalSpeech } from "./use-local-speech";

beforeEach(() => {
  mocks.sessions = [];
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

function setup() {
  const onText = vi.fn();
  const hook = renderHook((props) => useLocalSpeech({ ...props, onText }), {
    initialProps: { roomId: "one", locale: "pt-BR", enabled: true },
  });
  return { ...hook, onText };
}

describe("useLocalSpeech", () => {
  it("exposes preparation until the microphone is listening", () => {
    const { result } = setup();
    expect(result.current.captionIssue).toMatchObject({
      status: "retry_wait",
      retryable: false,
    });
    act(() => mocks.sessions[0].options.onStage("listening"));
    expect(result.current.captionIssue).toBeNull();
  });

  it("does not start another model download while preparing", () => {
    const { result } = setup();
    act(() => result.current.retryRecognition());
    expect(mocks.sessions).toHaveLength(1);
  });

  it("reports local errors without classifying them as Chrome network failures", () => {
    const { result } = setup();
    act(() =>
      mocks.sessions[0].options.onError({
        stage: "loading",
        errorName: "ModelLoadTimeout",
      }),
    );
    expect(result.current.captionIssue).toMatchObject({
      status: "blocked",
      retryable: true,
    });
    expect(mocks.report).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "start-failed",
        mode: "on-device",
        errorName: "ModelLoadTimeout",
      }),
    );
    act(() => result.current.retryRecognition());
    expect(mocks.sessions[0].stop).toHaveBeenCalledOnce();
    expect(mocks.sessions).toHaveLength(2);
  });

  it("rejects old text and errors after switching room or language", () => {
    const { rerender, onText, result } = setup();
    const old = mocks.sessions[0];
    rerender({ roomId: "two", locale: "en-US", enabled: true });
    expect(old.stop).toHaveBeenCalledOnce();
    act(() => {
      old.options.onText("stale");
      old.options.onError({ stage: "transcription", errorName: "WorkerError" });
    });
    expect(onText).not.toHaveBeenCalled();
    expect(mocks.report).not.toHaveBeenCalled();
    expect(result.current.captionIssue?.status).toBe("retry_wait");
    act(() => mocks.sessions[1].options.onText("new"));
    expect(onText).toHaveBeenCalledWith("new");
  });

  it("stops capture when muted and never accepts late results", () => {
    const { rerender, onText, result } = setup();
    const old = mocks.sessions[0];
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    act(() => old.options.onText("late"));
    expect(old.stop).toHaveBeenCalledOnce();
    expect(onText).not.toHaveBeenCalled();
    expect(result.current.captionIssue).toBeNull();
  });
});
