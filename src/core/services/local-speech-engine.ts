import { LocalSpeechSegmenter } from "./local-speech-segmenter";

export type LocalSpeechStage = "loading" | "microphone" | "listening";
export type LocalSpeechFailure = {
  stage: LocalSpeechStage | "transcription";
  errorName: string;
};
type Options = {
  locale: string;
  onStage: (stage: LocalSpeechStage) => void;
  onText: (text: string) => void;
  onError: (failure: LocalSpeechFailure) => void;
};

export function supportsLocalSpeech() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof Worker !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    typeof AudioWorkletNode !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/** One room/language session. stop() invalidates every asynchronous continuation. */
export class LocalSpeechEngine {
  private stopped = false;
  private started = false;
  private worker?: Worker;
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private processor?: AudioWorkletNode;
  private stage: LocalSpeechFailure["stage"] = "loading";
  private queue: Float32Array[] = [];
  private processing = false;
  private sequence = 0;
  private captureTimer?: ReturnType<typeof setTimeout>;
  private pending = new Map<
    number,
    {
      resolve: (text: string) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(private readonly options: Options) {}

  async start() {
    if (this.started || this.stopped) return;
    this.started = true;
    try {
      if (!supportsLocalSpeech()) throw new Error("LocalSpeechUnsupported");
      this.options.onStage("loading");
      this.context = new AudioContext({ sampleRate: 16_000 });
      this.worker = new Worker(
        new URL("./local-speech-worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = ({ data }) => {
        const request = this.pending.get(data.id);
        if (!request) return;
        clearTimeout(request.timer);
        this.pending.delete(data.id);
        if (data.type === "error") request.reject(new Error(data.errorName));
        else request.resolve(data.text ?? "");
      };
      this.worker.onerror = () => this.fail("WorkerError");
      await this.request({ type: "load" }, 120_000);
      if (this.stopped) return;
      this.stage = "microphone";
      this.options.onStage("microphone");
      this.captureTimer = setTimeout(
        () => this.fail("MicrophoneStartTimeout"),
        60_000,
      );
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
        video: false,
      });
      if (this.stopped) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      stream.getAudioTracks().forEach((track) => {
        track.onended = () => this.fail("MicrophoneEnded");
      });
      await this.context.audioWorklet.addModule(
        "/audio/dicere-pcm-processor.js",
      );
      if (this.stopped) return;
      await this.context.resume();
      if (this.stopped) return;
      const segmenter = new LocalSpeechSegmenter(this.context.sampleRate);
      this.source = this.context.createMediaStreamSource(stream);
      this.processor = new AudioWorkletNode(this.context, "dicere-pcm");
      this.processor.port.onmessage = ({
        data,
      }: MessageEvent<Float32Array>) => {
        if (this.stopped) return;
        const audio = segmenter.push(data);
        if (!audio) return;
        if (this.queue.length >= 3) {
          this.fail("TranscriptionTooSlow");
          return;
        }
        this.queue.push(audio);
        void this.drain();
      };
      this.processor.onprocessorerror = () => this.fail("AudioProcessorError");
      this.source.connect(this.processor);
      this.processor.connect(this.context.destination);
      this.stage = "listening";
      clearTimeout(this.captureTimer);
      this.options.onStage("listening");
    } catch (error) {
      if (!this.stopped) {
        const errorName =
          error instanceof DOMException
            ? error.name
            : error instanceof Error
              ? error.name === "Error"
                ? error.message
                : error.name
              : "UnknownError";
        this.fail(errorName);
      }
    }
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.captureTimer);
    this.queue = [];
    this.worker?.terminate();
    this.source?.disconnect();
    this.processor?.disconnect();
    this.processor?.port.close();
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => undefined);
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(new Error("SessionCancelled"));
    }
    this.pending.clear();
  }

  private fail(errorName: string) {
    if (this.stopped) return;
    const stage = this.stage;
    this.stop();
    this.options.onError({ stage, errorName: errorName.slice(0, 128) });
  }

  private request(
    message: Record<string, unknown>,
    timeout: number,
    transfer: Transferable[] = [],
  ) {
    return new Promise<string>((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            message.type === "load"
              ? "ModelLoadTimeout"
              : "TranscriptionTimeout",
          ),
        );
      }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.worker!.postMessage({ ...message, id }, transfer);
    });
  }

  private async drain() {
    if (this.processing || this.stopped) return;
    this.processing = true;
    try {
      while (this.queue.length && !this.stopped) {
        this.stage = "transcription";
        const audio = this.queue.shift()!;
        const text = await this.request(
          { type: "transcribe", audio, locale: this.options.locale },
          30_000,
          [audio.buffer],
        );
        if (!this.stopped && text) this.options.onText(text);
      }
      this.stage = "listening";
    } catch (error) {
      if (!this.stopped)
        this.fail(
          error instanceof Error ? error.message : "TranscriptionError",
        );
    } finally {
      this.processing = false;
    }
  }
}
