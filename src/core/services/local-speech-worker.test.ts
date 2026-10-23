import { beforeEach, afterEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  asr: vi.fn(),
  load: vi.fn(),
  hasSpeech: vi.fn(),
  loadVad: vi.fn(),
}));
vi.mock("@huggingface/transformers", () => ({
  env: { backends: { onnx: { wasm: {} } } },
  pipeline: mocks.load,
}));
vi.mock("./local-speech-vad-onnx", () => ({
  createLocalSpeechVad: mocks.loadVad,
}));

let scope: {
  onmessage: ((event: { data: unknown }) => Promise<void>) | null;
  postMessage: ReturnType<typeof vi.fn>;
};
beforeEach(async () => {
  vi.resetModules();
  vi.resetAllMocks();
  scope = { onmessage: null, postMessage: vi.fn() };
  vi.stubGlobal("self", scope);
  mocks.load.mockResolvedValue(mocks.asr);
  mocks.loadVad.mockResolvedValue({ hasSpeech: mocks.hasSpeech });
  mocks.asr.mockResolvedValue({ text: "Obrigado." });
  await import("./local-speech-worker");
});
afterEach(() => vi.unstubAllGlobals());

it("only reports ready after the voice detector and recognizer have loaded", async () => {
  let resolveVad!: (vad: unknown) => void;
  mocks.loadVad.mockReturnValue(
    new Promise((resolve) => {
      resolveVad = resolve;
    }),
  );
  const loading = scope.onmessage!({ data: { type: "load", id: 1 } });
  expect(scope.postMessage).not.toHaveBeenCalled();
  resolveVad({ hasSpeech: mocks.hasSpeech });
  await loading;
  expect(scope.postMessage).toHaveBeenCalledWith({ id: 1, type: "ready" });
});

it("returns an empty result for noise without asking Whisper to invent text", async () => {
  await scope.onmessage!({ data: { type: "load", id: 1 } });
  mocks.hasSpeech.mockResolvedValue(false);
  await scope.onmessage!({
    data: {
      type: "transcribe",
      id: 2,
      audio: new Float32Array(16000),
      locale: "pt-BR",
    },
  });
  expect(mocks.asr).not.toHaveBeenCalled();
  expect(scope.postMessage).toHaveBeenLastCalledWith({
    id: 2,
    type: "text",
    text: "",
  });
});

it("preserves a genuine Obrigado through the worker protocol", async () => {
  await scope.onmessage!({ data: { type: "load", id: 1 } });
  mocks.hasSpeech.mockResolvedValue(true);
  await scope.onmessage!({
    data: {
      type: "transcribe",
      id: 2,
      audio: new Float32Array(16000),
      locale: "pt-BR",
    },
  });
  expect(scope.postMessage).toHaveBeenLastCalledWith({
    id: 2,
    type: "text",
    text: "Obrigado.",
  });
});

it("reports a detector load failure without enabling unfiltered recognition", async () => {
  mocks.loadVad.mockRejectedValue(new Error("ModelUnavailable"));
  await scope.onmessage!({ data: { type: "load", id: 1 } });
  expect(mocks.load).not.toHaveBeenCalled();
  expect(scope.postMessage).toHaveBeenLastCalledWith({
    id: 1,
    type: "error",
    errorName: "Error",
  });
});
