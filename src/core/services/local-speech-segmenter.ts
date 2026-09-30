import { PcmFrameBuffer } from "./server-speech/pcm-frame-buffer";
import { SpeechActivityWindow } from "./server-speech/activity-window";
import { resampleLocalSpeech } from "./resample-local-speech";

/** Stable analysis windows; packet boundaries and timers cannot change the PCM. */
export class LocalSpeechSegmenter {
  private static readonly ANALYSIS_SAMPLES = 2048;
  private frames: Float32Array[] = [];
  private length = 0;
  private silentSamples = 0;
  private voicedSamples = 0;
  private active = false;
  private results: Float32Array[] = [];
  private readonly input: PcmFrameBuffer;
  private readonly minimumActivity: SpeechActivityWindow;

  constructor(private readonly sampleRate: number) {
    if (
      !Number.isInteger(sampleRate) ||
      sampleRate < 8000 ||
      sampleRate > 192000
    )
      throw new Error("InvalidSpeechSampleRate");
    this.minimumActivity = new SpeechActivityWindow(sampleRate);
    // Keep the existing worklet's canonical window, avoiding unvalidated VAD changes.
    this.input = new PcmFrameBuffer(
      LocalSpeechSegmenter.ANALYSIS_SAMPLES,
      (frame) => this.analyze(frame),
    );
  }

  push(frame: Float32Array): Float32Array[] {
    if (frame.some((sample) => !Number.isFinite(sample)))
      throw new Error("InvalidSpeechAudio");
    this.results = [];
    this.input.push(frame);
    return this.results;
  }

  private analyze(frame: Float32Array): void {
    // Preserve the production cutoff at the next canonical window: 8.064 s at
    // 16 kHz. Cutting 64 ms earlier regressed recognition in the real corpus.
    const hardLimit = this.sampleRate * 8;
    const rms = Math.sqrt(
      frame.reduce((sum, value) => sum + value * value, 0) / frame.length,
    );
    const voiced = rms >= 0.008;
    const activitySamples = frame.reduce(
      (count, sample) => count + (this.minimumActivity.push(sample) ? 1 : 0),
      0,
    );
    this.frames.push(frame.slice());
    this.length += frame.length;
    if (voiced) {
      this.active = true;
      // A click spanning two windows must not count as two full windows of voice.
      this.voicedSamples += activitySamples;
      this.silentSamples = 0;
    } else {
      this.silentSamples += frame.length;
    }
    if (!this.active) {
      while (this.frames.length > 1 && this.length > this.sampleRate * 0.25)
        this.length -= this.frames.shift()!.length;
      return;
    }
    const pause = this.length >= this.sampleRate * 6 ? 0.2 : 0.65;
    if (this.length < hardLimit && this.silentSamples < this.sampleRate * pause)
      return;
    if (this.voicedSamples >= this.sampleRate * 0.25) {
      const source = new Float32Array(this.length);
      let offset = 0;
      for (const part of this.frames) {
        source.set(part, offset);
        offset += part.length;
      }
      this.results.push(resampleLocalSpeech(source, this.sampleRate));
    }
    this.frames = [];
    this.length = this.silentSamples = this.voicedSamples = 0;
    this.active = false;
  }
}
