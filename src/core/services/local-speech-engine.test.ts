import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalSpeechEngine, supportsLocalSpeech } from "./local-speech-engine";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
  reply(data: unknown) {
    this.onmessage?.({ data });
  }
}

class FakeProcessor {
  static instances: FakeProcessor[] = [];
  port = {
    onmessage: undefined as
      ((event: { data: Float32Array }) => void) | undefined,
    close: vi.fn(),
  };
  connect = vi.fn();
  disconnect = vi.fn();
  constructor() {
    FakeProcessor.instances.push(this);
  }
}

const track = { stop: vi.fn(), onended: null as (() => void) | null };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
const close = vi.fn().mockResolvedValue(undefined);
const getUserMedia = vi.fn();
class FakeContext {
  sampleRate = 16000;
  state = "running";
  destination = {};
  audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
  resume = vi.fn().mockResolvedValue(undefined);
  close = close;
  createMediaStreamSource = () => ({ connect: vi.fn(), disconnect: vi.fn() });
}

function setup() {
  const callbacks = {
    locale: "pt-BR",
    onStage: vi.fn(),
    onText: vi.fn(),
    onError: vi.fn(),
  };
  const engine = new LocalSpeechEngine(callbacks);
  return { engine, ...callbacks };
}

async function ready() {
  const result = setup();
  const start = result.engine.start();
  FakeWorker.instances[0].reply({ id: 1, type: "ready" });
  await start;
  return result;
}

function phrase() {
  const processor = FakeProcessor.instances[0];
  for (let index = 0; index < 17; index += 1) {
    processor.port.onmessage?.({
      data: new Float32Array(1600).fill(index < 10 ? 0.1 : 0),
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  FakeWorker.instances = [];
  FakeProcessor.instances = [];
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("AudioContext", FakeContext);
  vi.stubGlobal("AudioWorkletNode", FakeProcessor);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  getUserMedia.mockResolvedValue(stream);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LocalSpeechEngine", () => {
  it("works without Web Speech API and never requests a microphone before the model is ready", async () => {
    expect(supportsLocalSpeech()).toBe(true);
    const { engine, onStage } = setup();
    const start = engine.start();
    expect(getUserMedia).not.toHaveBeenCalled();
    FakeWorker.instances[0].reply({ id: 1, type: "ready" });
    await start;
    expect(onStage.mock.calls.flat()).toEqual([
      "loading",
      "microphone",
      "listening",
    ]);
    engine.stop();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("sends PCM only to the local worker and returns final text", async () => {
    const { engine, onText } = await ready();
    phrase();
    const worker = FakeWorker.instances[0];
    expect(worker.postMessage.mock.calls[1][0]).toMatchObject({
      type: "transcribe",
      locale: "pt-BR",
      audio: expect.any(Float32Array),
    });
    worker.reply({ id: 2, type: "text", text: "Olá, tudo bem?" });
    await Promise.resolve();
    expect(onText).toHaveBeenCalledWith("Olá, tudo bem?");
    engine.stop();
  });

  it("cancels model loading without starting capture later", async () => {
    const { engine, onError } = setup();
    const start = engine.start();
    engine.stop();
    FakeWorker.instances[0].reply({ id: 1, type: "ready" });
    await start;
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("stops a microphone granted after leaving the room", async () => {
    let grant!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(
      new Promise((resolve) => {
        grant = resolve;
      }),
    );
    const { engine } = setup();
    const start = engine.start();
    FakeWorker.instances[0].reply({ id: 1, type: "ready" });
    await Promise.resolve();
    engine.stop();
    grant(stream);
    await start;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(FakeProcessor.instances).toHaveLength(0);
  });

  it("discards transcription completed after cancellation", async () => {
    const { engine, onText, onError } = await ready();
    phrase();
    engine.stop();
    FakeWorker.instances[0].reply({ id: 2, type: "text", text: "stale" });
    await Promise.resolve();
    expect(onText).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports a model timeout and terminates the worker", async () => {
    const { engine, onError } = setup();
    const start = engine.start();
    await vi.advanceTimersByTimeAsync(120000);
    await start;
    expect(onError).toHaveBeenCalledWith({
      stage: "loading",
      errorName: "ModelLoadTimeout",
    });
    expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });

  it("reports microphone permission denial without retry loops", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("denied", "NotAllowedError"),
    );
    const { onError } = await ready();
    expect(onError).toHaveBeenCalledWith({
      stage: "microphone",
      errorName: "NotAllowedError",
    });
  });

  it("fails visibly on slow inference instead of growing an unlimited queue", async () => {
    const { onError } = await ready();
    for (let index = 0; index < 5; index += 1) phrase();
    expect(onError).toHaveBeenCalledWith({
      stage: "transcription",
      errorName: "TranscriptionTooSlow",
    });
    expect(track.stop).toHaveBeenCalledOnce();
  });

  it("reports inference timeout and releases capture", async () => {
    const { onError } = await ready();
    phrase();
    await vi.advanceTimersByTimeAsync(30000);
    expect(onError).toHaveBeenCalledWith({
      stage: "transcription",
      errorName: "TranscriptionTimeout",
    });
    expect(track.stop).toHaveBeenCalledOnce();
  });
});
