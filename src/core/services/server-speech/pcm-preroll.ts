/** Owns only the latest 256 ms before voice; never a complete conversation. */
export class PcmPreroll {
  private readonly samples = new Float32Array(4096);
  private offset = 0;
  private count = 0;

  push(sample: number) {
    this.samples[this.offset] = sample;
    this.offset = (this.offset + 1) % this.samples.length;
    this.count = Math.min(this.count + 1, this.samples.length);
  }

  take() {
    const result = new Float32Array(this.count);
    const start =
      (this.offset - this.count + this.samples.length) % this.samples.length;
    for (let i = 0; i < result.length; i++)
      result[i] = this.samples[(start + i) % this.samples.length];
    this.offset = this.count = 0;
    this.samples.fill(0);
    return result;
  }
}
