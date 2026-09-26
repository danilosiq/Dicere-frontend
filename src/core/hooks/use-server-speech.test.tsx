import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RecoveringSpeechEngine } from "@/core/services/server-speech/recovery";

type Options = ConstructorParameters<typeof RecoveringSpeechEngine>[0];
const mocks = vi.hoisted(() => ({
  sessions: [] as { options: Options; stop: ReturnType<typeof vi.fn> }[],
}));
vi.mock("@/core/services/server-speech/recovery", () => ({
  RecoveringSpeechEngine: class {
    stop = vi.fn();
    constructor(public options: Options) {
      mocks.sessions.push(this);
    }
    start() {
      this.options.onStage("preparing");
    }
  },
}));
import { useServerSpeech } from "./use-server-speech";

beforeEach(() => {
  mocks.sessions = [];
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
function setup() {
  return renderHook((props) => useServerSpeech(props), {
    initialProps: { roomId: "one", locale: "pt-BR", enabled: true },
  });
}

describe("useServerSpeech recovery", () => {
  it("shows reconnecting without allowing overlapping manual attempts", () => {
    const { result } = setup();
    act(() => mocks.sessions[0].options.onError("STT_TIMEOUT", true, 1));
    expect(result.current.captionIssue).toMatchObject({
      status: "retry_wait",
      retryable: false,
    });
    expect(result.current.captionIssue?.message).toContain(
      "não será reenviado",
    );
    act(() => result.current.retryRecognition());
    expect(mocks.sessions).toHaveLength(1);
    act(() => mocks.sessions[0].options.onStage("listening"));
    expect(result.current.captionIssue).toBeNull();
  });

  it("offers an explicit fresh attempt after the automatic budget is exhausted", () => {
    const { result } = setup();
    act(() => mocks.sessions[0].options.onError("STT_TIMEOUT", false, 3));
    expect(result.current.captionIssue).toMatchObject({
      status: "blocked",
      retryable: true,
    });
    act(() => result.current.retryRecognition());
    expect(mocks.sessions[0].stop).toHaveBeenCalledOnce();
    expect(mocks.sessions).toHaveLength(2);
  });

  it("stops recovery on mute and ignores old callbacks after changing rooms", () => {
    const { rerender, result, unmount } = setup();
    const old = mocks.sessions[0];
    rerender({ roomId: "one", locale: "pt-BR", enabled: false });
    expect(old.stop).toHaveBeenCalledOnce();
    expect(result.current.captionIssue).toBeNull();
    rerender({ roomId: "two", locale: "pt-BR", enabled: true });
    act(() => old.options.onError("STT_TIMEOUT", true, 2));
    expect(console.error).not.toHaveBeenCalled();
    expect(result.current.captionIssue?.message).toContain("Verificando");
    unmount();
    expect(mocks.sessions[1].stop).toHaveBeenCalledOnce();
  });
});
