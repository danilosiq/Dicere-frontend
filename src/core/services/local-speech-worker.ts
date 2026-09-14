import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type PretrainedOptions,
} from "@huggingface/transformers";

env.allowLocalModels = false;
// Works without cross-origin isolation (which would interfere with call integrations).
if (env.backends.onnx.wasm) env.backends.onnx.wasm.numThreads = 1;

let transcriber: AutomaticSpeechRecognitionPipeline | undefined;
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
      if (!transcriber) throw new Error("ModelNotReady");
      const baseLanguage = String(data.locale).toLowerCase().split("-")[0];
      const output = await transcriber(data.audio as Float32Array, {
        language: baseLanguage === "nb" ? "no" : baseLanguage,
        task: "transcribe",
        max_new_tokens: 128,
        do_sample: false,
        return_timestamps: false,
      });
      const result = Array.isArray(output) ? output[0] : output;
      scope.postMessage({
        id: data.id,
        type: "text",
        text: result.text.trim(),
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
