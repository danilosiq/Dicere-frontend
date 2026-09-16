import type { SpeechStart } from "@/core/@types/server-speech";
import { requestSpeech } from "./transport";

type Command =
  { type: "start" | "finish" } | { type: "chunk"; audio: Uint8Array };

export class StreamingSpeechClient {
  private queue: Command[] = [];
  private bytes = 0;
  private processing = false;
  private stopped = false;
  private sessionId?: string;
  private sequence = 0;
  private readonly payload: SpeechStart;

  constructor(
    roomId: string,
    private readonly onError: (code: string) => void,
    private readonly request = requestSpeech,
  ) {
    this.payload = {
      version: 1,
      roomId,
      locale: "pt-BR",
      format: "pcm_s16le",
      sampleRate: 16000,
      channels: 1,
    };
  }

  async ready() {
    await this.request("speech_ready", this.payload);
  }
  start() {
    this.enqueue({ type: "start" });
  }
  finish() {
    this.enqueue({ type: "finish" });
  }

  chunk(frame: Float32Array) {
    if (this.stopped) return;
    const audio = new Uint8Array(frame.length * 2);
    const view = new DataView(audio.buffer);
    frame.forEach((value, index) => {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(
        index * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true,
      );
    });
    this.enqueue({ type: "chunk", audio });
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.queue = [];
    this.bytes = 0;
    void this.request(
      "speech_cancel",
      this.sessionId ? { sessionId: this.sessionId } : {},
    ).catch(() => undefined);
    this.sessionId = undefined;
  }

  private enqueue(command: Command) {
    if (this.stopped) return;
    if (command.type === "chunk") this.bytes += command.audio.byteLength;
    if (this.bytes > 64000 || this.queue.length >= 32) {
      this.stop();
      this.onError("STT_BACKPRESSURE");
      return;
    }
    this.queue.push(command);
    void this.drain();
  }

  private async drain() {
    if (this.processing || this.stopped) return;
    this.processing = true;
    try {
      while (this.queue.length && !this.stopped) {
        const command = this.queue.shift()!;
        if (command.type === "start") {
          const result = await this.request("speech_start", this.payload);
          if (!result.sessionId) throw new Error("STT_INVALID_RESPONSE");
          if (this.stopped) {
            void this.request("speech_cancel", {
              sessionId: result.sessionId,
            }).catch(() => undefined);
            break;
          }
          this.sessionId = result.sessionId;
          this.sequence = 0;
        } else {
          if (!this.sessionId) throw new Error("STT_SESSION_NOT_FOUND");
          if (command.type === "chunk") {
            await this.request("speech_chunk", {
              sessionId: this.sessionId,
              sequence: this.sequence++,
              audio: command.audio,
            });
            this.bytes = Math.max(0, this.bytes - command.audio.byteLength);
          } else {
            await this.request("speech_finish", {
              sessionId: this.sessionId,
              lastSequence: this.sequence - 1,
            });
            this.sessionId = undefined;
          }
        }
      }
    } catch (error) {
      if (!this.stopped) {
        this.stop();
        this.onError(
          error instanceof Error && /^STT_[A-Z_]+$/.test(error.message)
            ? error.message
            : "STT_FAILED",
        );
      }
    } finally {
      this.processing = false;
    }
  }
}
