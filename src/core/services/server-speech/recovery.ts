import { ServerSpeechEngine, type ServerSpeechOptions } from "./engine";
import { getSocket } from "../socket-service";
import {
  isRecoverableSpeechError,
  speechRecoveryDelay,
} from "./recovery-policy";

type Options = Omit<ServerSpeechOptions, "onError"> & {
  canStart?: () => boolean;
  onError: (code: string, recovering: boolean, attempt: number) => void;
};

/** Restarts only fresh capture; never replays audio with an uncertain ACK. */
export class RecoveringSpeechEngine {
  private engine?: ServerSpeechEngine;
  private stopped = false;
  private started = false;
  private pending = false;
  private generation = 0;
  private attempt = 0;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private stableTimer?: ReturnType<typeof setTimeout>;
  private readonly leaving = () => this.stop();
  private readonly offline = () => this.failed("STT_DISCONNECTED");
  private readonly visibility = () => {
    if (document.visibilityState === "visible") this.wake();
  };
  private readonly wake = () => {
    if (this.stopped || !this.pending || !this.available()) return;
    clearTimeout(this.retryTimer);
    this.begin();
  };

  constructor(private readonly options: Options) {}

  start() {
    if (this.stopped || this.started) return;
    this.started = true;
    window.addEventListener("pagehide", this.leaving);
    window.addEventListener("offline", this.offline);
    window.addEventListener("online", this.wake);
    document.addEventListener("visibilitychange", this.visibility);
    document.addEventListener("resume", this.wake);
    // A connected socket is not yet an authorized room. Wake after admission.
    getSocket().on("room_joined", this.wake);
    this.begin();
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.generation++;
    clearTimeout(this.retryTimer);
    clearTimeout(this.stableTimer);
    this.engine?.stop();
    window.removeEventListener("pagehide", this.leaving);
    window.removeEventListener("offline", this.offline);
    window.removeEventListener("online", this.wake);
    document.removeEventListener("visibilitychange", this.visibility);
    document.removeEventListener("resume", this.wake);
    getSocket().off("room_joined", this.wake);
  }

  private available() {
    return (
      navigator.onLine !== false &&
      getSocket().connected !== false &&
      this.options.canStart?.() !== false
    );
  }

  private begin() {
    if (this.stopped) return;
    if (!this.available()) {
      this.pending = true;
      this.options.onError("STT_DISCONNECTED", true, this.attempt);
      return;
    }
    this.pending = false;
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
        if (current()) this.failed(code);
      },
    });
    void this.engine.start();
  }

  private failed(code: string) {
    if (this.stopped) return;
    this.generation++;
    clearTimeout(this.stableTimer);
    clearTimeout(this.retryTimer);
    this.engine?.stop();
    this.pending = isRecoverableSpeechError(code);
    if (this.pending) {
      this.attempt++;
      if (navigator.onLine !== false)
        this.retryTimer = setTimeout(
          () => this.begin(),
          speechRecoveryDelay(this.attempt),
        );
    }
    this.options.onError(code, this.pending, this.attempt);
  }
}
