import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ServerSpeechOptions } from "./engine";

const mocks = vi.hoisted(() => ({
  socket: { connected: true, on: vi.fn(), off: vi.fn() },
  sessions: [] as {
    options: ServerSpeechOptions;
    stop: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock("../socket-service", () => ({ getSocket: () => mocks.socket }));
vi.mock("./engine", () => ({
  ServerSpeechEngine: class {
    stop = vi.fn();
    constructor(public options: ServerSpeechOptions) {
      mocks.sessions.push(this);
    }
    async start() {
      this.options.onStage("preparing");
    }
  },
}));
import { RecoveringSpeechEngine } from "./recovery";

beforeEach(() => {
  vi.useFakeTimers();
  mocks.sessions = [];
  mocks.socket.connected = true;
  mocks.socket.on.mockClear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  const onStage = vi.fn();
  const onError = vi.fn();
  const engine = new RecoveringSpeechEngine({
    roomId: "one",
    locale: "pt-BR",
    onStage,
    onError,
  });
  engine.start();
  return { engine, onStage, onError };
}

describe("RecoveringSpeechEngine", () => {
  it("does not restart on a connected transport before room readmission", () => {
    let admitted = true;
    const engine = new RecoveringSpeechEngine({
      roomId: "one",
      locale: "pt-BR",
      onStage: vi.fn(),
      onError: vi.fn(),
      canStart: () => admitted,
    });
    engine.start();
    admitted = false;
    mocks.sessions[0].options.onError("STT_DISCONNECTED");
    vi.advanceTimersByTime(500);
    const joined = mocks.socket.on.mock.calls.find(
      ([event]) => event === "room_joined",
    )![1];
    joined();
    expect(mocks.sessions).toHaveLength(1);
    admitted = true;
    joined();
    expect(mocks.sessions).toHaveLength(2);
    engine.stop();
  });
  it("recreates a fresh engine after a bounded delay without replaying audio", () => {
    const { engine, onError } = setup();
    const old = mocks.sessions[0];
    old.options.onError("STT_TIMEOUT");
    expect(old.stop).toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith("STT_TIMEOUT", true, 1);
    vi.advanceTimersByTime(499);
    expect(mocks.sessions).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(mocks.sessions).toHaveLength(2);
    expect(mocks.sessions[1].options.roomId).toBe("one");
    engine.stop();
  });

  it("keeps recovering with capped backoff after more than three failures", () => {
    const { engine, onError } = setup();
    for (const delay of [500, 1000, 2000, 4000, 8000, 16000, 30000]) {
      const current = mocks.sessions.at(-1)!;
      current.options.onStage("listening");
      current.options.onError("STT_UNAVAILABLE");
      vi.advanceTimersByTime(delay);
    }
    expect(mocks.sessions).toHaveLength(8);
    expect(onError).toHaveBeenLastCalledWith("STT_UNAVAILABLE", true, 7);
    engine.stop();
  });

  it.each([
    "STT_PERMISSION_DENIED",
    "STT_LANGUAGE_UNSUPPORTED",
    "STT_TRANSLATION_QUOTA_EXCEEDED",
    "STT_FORBIDDEN",
    "STT_INVALID_RESPONSE",
    "STT_UTTERANCE_TOO_LONG",
  ])("never automatically retries %s", (code) => {
    const { engine, onError } = setup();
    mocks.sessions[0].options.onError(code);
    vi.advanceTimersByTime(60000);
    expect(mocks.sessions).toHaveLength(1);
    expect(onError).toHaveBeenCalledWith(code, false, 0);
    engine.stop();
  });

  it("ignores callbacks from a failed engine and clears recovery on mute/exit", () => {
    const { engine, onStage, onError } = setup();
    const old = mocks.sessions[0];
    old.options.onError("STT_DISCONNECTED");
    onStage.mockClear();
    onError.mockClear();
    old.options.onStage("listening");
    old.options.onError("STT_TIMEOUT");
    expect(onStage).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    engine.stop();
    vi.advanceTimersByTime(60000);
    expect(mocks.sessions).toHaveLength(1);
  });

  it("cancels pending recovery on pagehide", () => {
    const { engine } = setup();
    mocks.sessions[0].options.onError("STT_BUSY");
    window.dispatchEvent(new Event("pagehide"));
    vi.advanceTimersByTime(60000);
    expect(mocks.sessions).toHaveLength(1);
    engine.stop();
  });

  it("keeps listening and retries in a hidden tab", () => {
    const { engine, onError } = setup();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onError).not.toHaveBeenCalled();
    expect(mocks.sessions[0].stop).not.toHaveBeenCalled();
    mocks.sessions[0].options.onError("STT_BACKPRESSURE");
    vi.advanceTimersByTime(500);
    expect(mocks.sessions).toHaveLength(2);
    engine.stop();
  });

  it("waits offline and resumes only after the room is admitted again", () => {
    const { engine } = setup();
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    vi.advanceTimersByTime(60000);
    expect(mocks.sessions).toHaveLength(1);
    mocks.socket.connected = false;
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
    expect(mocks.sessions).toHaveLength(1);
    mocks.socket.connected = true;
    mocks.socket.on.mock.calls.find(([event]) => event === "room_joined")![1]();
    expect(mocks.sessions).toHaveLength(2);
    engine.stop();
  });

  it("renews the retry budget only after thirty seconds listening", () => {
    const { engine, onError } = setup();
    mocks.sessions[0].options.onError("STT_ACK_TIMEOUT");
    vi.advanceTimersByTime(500);
    mocks.sessions[1].options.onStage("listening");
    vi.advanceTimersByTime(30000);
    mocks.sessions[1].options.onError("STT_TIMEOUT");
    expect(onError).toHaveBeenLastCalledWith("STT_TIMEOUT", true, 1);
    engine.stop();
  });
});
