import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type PretrainedOptions,
} from "@huggingface/transformers";
import { createLocalSpeechVad } from "./local-speech-vad-onnx";
import { transcribeLocalSpeech } from "./local-speech-transcription";
import type { LocalSpeechVad } from "./local-speech-vad";

env.allowLocalModels = false;
// Works without cross-origin isolation (which would interfere with call integrations).
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

let transcriber: AutomaticSpeechRecognitionPipeline | undefined;
let vad: LocalSpeechVad | undefined;
// Narrow the generic factory to ASR; the full task union exceeds TS's complexity limit.
const createTranscriber = pipeline as (
  task: "automatic-speech-recognition",
  model: string,
  options: PretrainedOptions & { device: "wasm"; dtype: "q8" },
) => Promise<AutomaticSpeechRecognitionPipeline>;
const scope = self as unknown as {
  onmessage: ((event: MessageEvent) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = async ({ data }) => {
  try {
    if (data.type === "load") {
      vad = await createLocalSpeechVad();
      transcriber = await createTranscriber(
        "automatic-speech-recognition",
        "onnx-community/whisper-tiny",
        {
          revision: "ff4177021cc41f7db950912b73ea4fdf7d01d8e7",
          device: "wasm",
          dtype: "q8",
        },
      );
      scope.postMessage({ id: data.id, type: "ready" });
    } else if (data.type === "transcribe") {
      if (!transcriber || !vad) throw new Error("ModelNotReady");
      const text = await transcribeLocalSpeech(
        data.audio as Float32Array,
        String(data.locale),
        vad,
        transcriber,
      );
      scope.postMessage({
        id: data.id,
        type: "text",
        text,
      });
    }
  } catch (error) {
    // Technical detail only; never echo audio or inferred text in diagnostics.
    scope.postMessage({
      id: data.id,
      type: "error",
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
  }
};
