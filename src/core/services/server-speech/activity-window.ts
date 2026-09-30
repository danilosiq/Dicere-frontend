/** Sliding 16 ms energy window. Decisions do not depend on packet boundaries. */
export class SpeechActivityWindow {
  private readonly squares: Float64Array;
  private offset = 0;
  private energy = 0;

  constructor(sampleRate = 16000) {
    this.squares = new Float64Array(
      Math.max(1, Math.round(sampleRate * 0.016)),
    );
  }

  push(sample: number) {
    const square = sample * sample;
    this.energy += square - this.squares[this.offset];
    this.squares[this.offset] = square;
    this.offset = (this.offset + 1) % this.squares.length;
    return this.energy >= 0.008 ** 2 * this.squares.length;
  }
}
