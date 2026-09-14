/** PCM segmentation is sample-based, so background timer throttling cannot grow a buffer. */
export class LocalSpeechSegmenter {
  private frames: Float32Array[] = [];
  private length = 0;
  private silentSamples = 0;
  private voicedSamples = 0;
  private active = false;

  constructor(private readonly sampleRate: number) {}

  push(frame: Float32Array): Float32Array | null {
    const rms = Math.sqrt(
      frame.reduce((sum, value) => sum + value * value, 0) / frame.length,
    );
    const voiced = rms >= 0.008;
    this.frames.push(frame.slice());
    this.length += frame.length;
    if (voiced) {
      this.active = true;
      this.voicedSamples += frame.length;
      this.silentSamples = 0;
    } else {
      this.silentSamples += frame.length;
    }
    if (!this.active) {
      // Keep a short pre-roll to avoid clipping initial consonants.
      while (this.frames.length > 1 && this.length > this.sampleRate * 0.25) {
        this.length -= this.frames.shift()!.length;
      }
      return null;
    }
    if (
      this.length < this.sampleRate * 6 &&
      this.silentSamples < this.sampleRate * 0.65
    ) {
      return null;
    }
    const result =
      this.voicedSamples >= this.sampleRate * 0.25
        ? this.joinAndResample()
        : null;
    this.frames = [];
    this.length = this.silentSamples = this.voicedSamples = 0;
    this.active = false;
    return result;
  }

  private joinAndResample() {
    const source = new Float32Array(this.length);
    let offset = 0;
    for (const frame of this.frames) {
      source.set(frame, offset);
      offset += frame.length;
    }
    if (this.sampleRate === 16_000) return source;
    const ratio = this.sampleRate / 16_000;
    const result = new Float32Array(Math.floor(source.length / ratio));
    // Average source samples when downsampling instead of dropping samples.
    for (let index = 0; index < result.length; index += 1) {
      const start = Math.floor(index * ratio);
      const end = Math.max(start + 1, Math.floor((index + 1) * ratio));
      let sum = 0;
      for (let cursor = start; cursor < end; cursor += 1) sum += source[cursor];
      result[index] = sum / (end - start);
    }
    return result;
  }
}
