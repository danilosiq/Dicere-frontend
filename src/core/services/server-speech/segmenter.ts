type Callbacks = {
  start: () => void;
  chunk: (frame: Float32Array) => void;
  finish: () => void;
};

/** Candidate endpointing, not yet corpus-approved. Input is 16 kHz mono PCM. */
export class StreamingSegmenter {
  private preroll: Float32Array[] = [];
  private active = false;
  private samples = 0;
  private silentSamples = 0;

  constructor(private readonly callbacks: Callbacks) {}

  push(frame: Float32Array) {
    if (
      !frame.length ||
      frame.length > 8000 ||
      frame.some((value) => !Number.isFinite(value))
    )
      throw new Error("STT_INVALID_AUDIO");
    const rms = Math.sqrt(
      frame.reduce((sum, value) => sum + value * value, 0) / frame.length,
    );
    const voiced = rms >= 0.008;
    if (!this.active && !voiced) {
      this.preroll.push(frame.slice());
      while (this.preroll.reduce((sum, item) => sum + item.length, 0) > 4096)
        this.preroll.shift();
      return;
    }
    if (!this.active) {
      this.active = true;
      this.samples = this.preroll.reduce((sum, item) => sum + item.length, 0);
      this.callbacks.start();
      this.preroll.forEach((item) => this.callbacks.chunk(item));
      this.preroll = [];
    }
    this.samples += frame.length;
    if (this.samples > 192000) throw new Error("STT_UTTERANCE_TOO_LONG");
    this.callbacks.chunk(frame);
    this.silentSamples = voiced ? 0 : this.silentSamples + frame.length;
    if (this.silentSamples >= 10400) {
      this.callbacks.finish();
      this.active = false;
      this.samples = this.silentSamples = 0;
    }
  }
}
