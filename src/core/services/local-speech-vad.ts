/** Silero's fixed 32ms frames at 16kHz; runs in the existing speech worker. */
export type SpeechProbability = (
  frame: Float32Array,
  reset: boolean,
) => Promise<number>;

export class LocalSpeechVad {
  constructor(private readonly infer: SpeechProbability) {}

  async hasSpeech(audio: Float32Array): Promise<boolean> {
    // Eight seconds plus one analysis window at the lowest supported capture
    // rate (8kHz). Its 2048 samples may expand to 4096 after resampling to 16kHz.
    if (
      audio.length > 16000 * 8 + 4096 ||
      audio.some((value) => !Number.isFinite(value))
    )
      throw new Error("InvalidSpeechAudio");
    let sustainedSamples = 0;
    for (let offset = 0; offset < audio.length; offset += 512) {
      const samples = audio.subarray(offset, offset + 512);
      const frame = new Float32Array(512);
      frame.set(samples);
      const probability = await this.infer(frame, offset === 0);
      if (!Number.isFinite(probability) || probability < 0 || probability > 1)
        throw new Error("InvalidSpeechProbability");
      sustainedSamples =
        probability >= 0.5 ? sustainedSamples + samples.length : 0;
      // Energy and the sum of separate clicks are not evidence of speech.
      if (sustainedSamples >= 16000 * 0.25) return true;
    }
    return false;
  }
}
