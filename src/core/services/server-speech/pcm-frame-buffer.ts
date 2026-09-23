/** Reblocks PCM without losing samples or retaining a whole utterance. */
export class PcmFrameBuffer {
  private buffer: Float32Array;
  private offset = 0;

  constructor(
    private readonly size: number,
    private readonly emit: (frame: Float32Array) => void,
  ) {
    this.buffer = new Float32Array(size);
  }

  push(input: Float32Array) {
    for (let read = 0; read < input.length;) {
      const count = Math.min(this.size - this.offset, input.length - read);
      this.buffer.set(input.subarray(read, read + count), this.offset);
      this.offset += count;
      read += count;
      if (this.offset === this.size) this.flush();
    }
  }

  flush() {
    if (!this.offset) return;
    const frame = this.buffer.slice(0, this.offset);
    this.offset = 0;
    this.emit(frame);
  }

  pushSample(sample: number) {
    this.buffer[this.offset++] = sample;
    if (this.offset === this.size) this.flush();
  }
}
