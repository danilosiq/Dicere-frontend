import { env, InferenceSession, Tensor } from "onnxruntime-web";
import { LocalSpeechVad } from "./local-speech-vad";

export async function createLocalSpeechVad(): Promise<LocalSpeechVad> {
  env.wasm.numThreads = 1;
  // Explicit pinned runtime location: the worker's hashed Next.js URL is not a
  // directory containing ORT binaries. No microphone data is sent to this CDN.
  env.wasm.wasmPaths ??=
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/";
  const session = await InferenceSession.create(
    "/audio/vad/silero-v5.1.2.onnx",
    {
      executionProviders: ["wasm"],
    },
  );
  let state: Tensor = new Tensor("float32", new Float32Array(256), [2, 1, 128]);
  let context = new Float32Array(64);
  const sampleRate = new Tensor(
    "int64",
    BigInt64Array.from([BigInt(16000)]),
    [],
  );

  return new LocalSpeechVad(async (frame, reset) => {
    if (reset) {
      state = new Tensor("float32", new Float32Array(256), [2, 1, 128]);
      context = new Float32Array(64);
    }
    // Silero v5 requires 64 preceding samples as well as its recurrent state.
    const input = new Float32Array(576);
    input.set(context);
    input.set(frame, 64);
    const result = await session.run({
      input: new Tensor("float32", input, [1, 576]),
      state,
      sr: sampleRate,
    });
    state = result.stateN;
    context = input.slice(-64);
    return Number(result.output.data[0]);
  });
}
