import { getSocket } from "../socket-service";
import { StreamingSpeechClient } from "./client";
import { SpeechMicrophone } from "./microphone";
import { StreamingSegmenter } from "./segmenter";

type Stage = "preparing" | "microphone" | "listening";
type Options = {
  roomId: string;
  locale: string;
  onStage: (stage: Stage) => void;
  onError: (code: string) => void;
};

export class ServerSpeechEngine {
  private stopped = false;
  private readonly client: StreamingSpeechClient;
  private readonly microphone: SpeechMicrophone;
  private readonly disconnect = () => this.fail("STT_DISCONNECTED");
  private readonly visibility = () => {
    if (document.visibilityState === "hidden")
      this.fail("STT_BACKGROUND_PAUSED");
  };
  private readonly leaving = () => this.stop();

  constructor(private readonly options: Options) {
    this.client = new StreamingSpeechClient(options.roomId, (code) =>
      this.fail(code),
    );
    const segmenter = new StreamingSegmenter({
      start: () => this.client.start(),
      chunk: (frame) => this.client.chunk(frame),
      finish: () => this.client.finish(),
    });
    this.microphone = new SpeechMicrophone(
      (frame) => {
        try {
          segmenter.push(frame);
        } catch (error) {
          this.handleError(error);
        }
      },
      (code) => this.fail(code),
    );
  }

  async start() {
    try {
      if (this.options.locale !== "pt-BR")
        throw new Error("STT_LANGUAGE_UNSUPPORTED");
      getSocket().on("disconnect", this.disconnect);
      document.addEventListener("visibilitychange", this.visibility);
      window.addEventListener("pagehide", this.leaving);
      this.visibility();
      if (this.stopped) return;
      this.options.onStage("preparing");
      await this.client.ready();
      if (this.stopped) return;
      this.options.onStage("microphone");
      await this.microphone.start();
      if (!this.stopped) this.options.onStage("listening");
    } catch (error) {
      this.handleError(error);
    }
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.client.stop();
    this.microphone.stop();
    getSocket().off("disconnect", this.disconnect);
    document.removeEventListener("visibilitychange", this.visibility);
    window.removeEventListener("pagehide", this.leaving);
  }

  private handleError(error: unknown) {
    this.fail(
      error instanceof DOMException && error.name === "NotAllowedError"
        ? "STT_PERMISSION_DENIED"
        : error instanceof Error && /^STT_[A-Z_]+$/.test(error.message)
          ? error.message
          : "STT_FAILED",
    );
  }
  private fail(code: string) {
    if (this.stopped) return;
    this.stop();
    this.options.onError(code);
  }
}
