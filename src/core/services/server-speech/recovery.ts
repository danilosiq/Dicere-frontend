import { ServerSpeechEngine, type ServerSpeechOptions } from "./engine";

const delays = [500, 1000, 2000];
const transientErrors = new Set([
  "STT_UNAVAILABLE",
  "STT_BUSY",
  "STT_TIMEOUT",
  "STT_ACK_TIMEOUT",
  "STT_DISCONNECTED",
]);
type Options = Omit<ServerSpeechOptions, "onError"> & {
  onError: (code: string, recovering: boolean, attempt: number) => void;
};

/** Restarts capture, never a failed utterance. Owns no audio or call media. */
export class RecoveringSpeechEngine {
  private engine?: ServerSpeechEngine;
  private stopped = false;
  private started = false;
  private generation = 0;
  private attempt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stableTimer?: ReturnType<typeof setTimeout>;
  private readonly leaving = () => this.stop();
  private readonly visibility = () => {
    if (document.visibilityState !== "hidden" || this.stopped) return;
    this.stop();
    this.options.onError("STT_BACKGROUND_PAUSED", false, this.attempt);
  };

  constructor(private readonly options: Options) {}

  start() {
    if (this.stopped || this.started) return;
    this.started = true;
    window.addEventListener("pagehide", this.leaving);
    document.addEventListener("visibilitychange", this.visibility);
    this.visibility();
    if (!this.stopped) this.begin();
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.generation++;
    clearTimeout(this.retryTimer);
    clearTimeout(this.stableTimer);
    this.engine?.stop();
    window.removeEventListener("pagehide", this.leaving);
    document.removeEventListener("visibilitychange", this.visibility);
  }

  private begin() {
    const generation = ++this.generation;
    const current = () => !this.stopped && generation === this.generation;
    this.engine = new ServerSpeechEngine({
      roomId: this.options.roomId,
      locale: this.options.locale,
      onStage: (stage) => {
        if (!current()) return;
        clearTimeout(this.stableTimer);
        if (stage === "listening")
          this.stableTimer = setTimeout(() => {
            if (current()) this.attempt = 0;
          }, 30000);
        this.options.onStage(stage);
      },
      onError: (code) => {
        if (!current()) return;
        this.generation++;
        clearTimeout(this.stableTimer);
        this.engine?.stop();
        const delay = transientErrors.has(code)
          ? delays[this.attempt]
          : undefined;
        if (delay !== undefined) {
          this.attempt++;
          this.retryTimer = setTimeout(() => {
            if (!this.stopped) this.begin();
          }, delay);
        }
        this.options.onError(code, delay !== undefined, this.attempt);
      },
    });
    void this.engine.start();
  }
}
