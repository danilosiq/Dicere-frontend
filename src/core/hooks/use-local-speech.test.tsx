import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
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
  sessions: [] as {
    options: Options;
    stop: ReturnType<typeof vi.fn>;
    finishClosedSegments: ReturnType<typeof vi.fn>;
  }[],
  report: vi.fn(),
}));
vi.mock("@/core/services/local-speech-engine", () => ({
  LocalSpeechEngine: class {
    stop = vi.fn();
    finishClosedSegments = vi.fn(() => Promise.resolve());
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

  it("drains completed text on mute, but cancels it on room change", async () => {
    const { rerender, onText, result } = setup();
    const old = mocks.sessions[0];
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    expect(old.finishClosedSegments).toHaveBeenCalledOnce();
    expect(old.stop).not.toHaveBeenCalled();
    act(() => old.options.onText("completed before mute"));
    expect(onText).toHaveBeenCalledWith("completed before mute");
    expect(result.current.captionIssue).toBeNull();
    rerender({ roomId: "two", locale: "pt-BR", enabled: false });
    act(() => old.options.onText("stale"));
    expect(old.stop).toHaveBeenCalledOnce();
    expect(onText).toHaveBeenCalledTimes(1);
  });

  it("waits for the old drain before unmute, and skips start if muted again", async () => {
    let release!: () => void;
    const drain = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { rerender } = setup();
    mocks.sessions[0].finishClosedSegments.mockReturnValue(drain);
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    rerender({ roomId: "one", locale: "pt-BR", enabled: true });
    expect(mocks.sessions).toHaveLength(1);
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    await act(async () => release());
    expect(mocks.sessions).toHaveLength(1);
    rerender({ roomId: "one", locale: "pt-BR", enabled: true });
    await act(async () => {});
    expect(mocks.sessions).toHaveLength(2);
  });

  it("reports muted drain failures without showing old loading stages", () => {
    const { rerender, result } = setup();
    const old = mocks.sessions[0];
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    act(() => old.options.onStage("loading"));
    expect(result.current.captionIssue).toBeNull();
    act(() =>
      old.options.onError({
        stage: "transcription",
        errorName: "TranscriptionTimeout",
      }),
    );
    expect(result.current.captionIssue?.status).toBe("blocked");
    rerender({ roomId: "two", locale: "pt-BR", enabled: false });
    expect(result.current.captionIssue).toBeNull();
  });

  it("cancels pending drain on unmount and ignores its late callbacks", async () => {
    let release!: () => void;
    const { rerender, unmount, onText } = setup();
    const old = mocks.sessions[0];
    old.finishClosedSegments.mockReturnValue(
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    );
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    unmount();
    expect(old.stop).toHaveBeenCalledOnce();
    act(() => old.options.onText("late"));
    await act(async () => release());
    expect(onText).not.toHaveBeenCalled();
  });

  it("cancels StrictMode's discarded session before the active one starts", async () => {
    const onText = vi.fn();
    renderHook(
      () =>
        useLocalSpeech({
          roomId: "one",
          locale: "pt-BR",
          enabled: true,
          onText,
        }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <StrictMode>{children}</StrictMode>
        ),
      },
    );
    await act(async () => {});
    const active = mocks.sessions.filter(
      (session) => !session.stop.mock.calls.length,
    );
    expect(active).toHaveLength(1);
    for (const discarded of mocks.sessions.filter(
      (session) => session !== active[0],
    )) {
      act(() => discarded.options.onText("discarded"));
    }
    act(() => active[0].options.onText("current"));
    expect(onText.mock.calls.flat()).toEqual(["current"]);
  });
});
