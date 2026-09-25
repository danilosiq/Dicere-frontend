import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  ready: vi.fn(),
  start: vi.fn(),
  clientStop: vi.fn(),
  micStop: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  microphoneCallback: undefined as undefined | ((frame: Float32Array) => void),
}));
vi.mock("./client", () => ({
  StreamingSpeechClient: class {
    ready = mocks.ready;
    stop = mocks.clientStop;
    start = vi.fn();
    finish = vi.fn();
    chunk = vi.fn();
  },
}));
vi.mock("./microphone", () => ({
  SpeechMicrophone: class {
    constructor(callback: (frame: Float32Array) => void) {
      mocks.microphoneCallback = callback;
    }
    start = mocks.start;
    stop = mocks.micStop;
  },
}));
vi.mock("../socket-service", () => ({
  getSocket: () => ({ on: mocks.on, off: mocks.off }),
}));
import { ServerSpeechEngine } from "./engine";
import { DEEPL_TARGET_LANGUAGES } from "@/core/components/selector-country/countryList";
import { toSpeechRecognitionLocale } from "@/core/utils/speech-recognition-language";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.ready.mockResolvedValue(undefined);
  mocks.start.mockResolvedValue(undefined);
});
function setup(locale = "pt-BR") {
  const options = {
    roomId: "room",
    locale,
    onStage: vi.fn(),
    onError: vi.fn(),
  };
  return { ...options, engine: new ServerSpeechEngine(options) };
}
describe("ServerSpeechEngine", () => {
  it("requires service readiness before starting the microphone", async () => {
    const { engine, onStage } = setup();
    await engine.start();
    expect(mocks.ready.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.start.mock.invocationCallOrder[0],
    );
    expect(onStage.mock.calls.flat()).toEqual([
      "preparing",
      "microphone",
      "listening",
    ]);
    engine.stop();
    expect(mocks.micStop).toHaveBeenCalledOnce();
  });
  it("does not capture after mute during readiness", async () => {
    let ready!: () => void;
    mocks.ready.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          ready = resolve;
        }),
    );
    const { engine, onError } = setup();
    const start = engine.start();
    engine.stop();
    ready();
    await start;
    expect(mocks.start).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
  it.each(DEEPL_TARGET_LANGUAGES.filter((language) => language !== "PT-BR"))(
    "refuses unsupported spoken %s before capture or service access",
    async (language) => {
      const { engine, onError } = setup(toSpeechRecognitionLocale(language));
      await engine.start();
      expect(onError).toHaveBeenCalledWith("STT_LANGUAGE_UNSUPPORTED");
      expect(mocks.start).not.toHaveBeenCalled();
      expect(mocks.ready).not.toHaveBeenCalled();
    },
  );
  it("reports denied permission without retry loops", async () => {
    mocks.start.mockRejectedValue(
      new DOMException("private message", "NotAllowedError"),
    );
    const { engine, onError } = setup();
    await engine.start();
    expect(onError).toHaveBeenCalledWith("STT_PERMISSION_DENIED");
    expect(mocks.start).toHaveBeenCalledOnce();
    expect(mocks.micStop).toHaveBeenCalledOnce();
  });
  it("cancels when disconnected and does not restart capture implicitly", async () => {
    const { engine, onError } = setup();
    await engine.start();
    mocks.on.mock.calls[0][1]();
    expect(onError).toHaveBeenCalledWith("STT_DISCONNECTED");
    expect(mocks.clientStop).toHaveBeenCalledOnce();
    expect(mocks.micStop).toHaveBeenCalledOnce();
  });
});
