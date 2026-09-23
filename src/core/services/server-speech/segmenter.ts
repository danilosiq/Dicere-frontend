import { PcmFrameBuffer } from "./pcm-frame-buffer";
import { SpeechActivityWindow } from "./activity-window";
import { PcmPreroll } from "./pcm-preroll";

type Callbacks = {
  start: () => void;
  chunk: (frame: Float32Array) => void;
  finish: () => void;
};

/** Candidate endpointing, not yet corpus-approved. Input is 16 kHz mono PCM. */
export class StreamingSegmenter {
  private readonly preroll = new PcmPreroll();
  private active = false;
  private samples = 0;
  private silentSamples = 0;
  private readonly activity = new SpeechActivityWindow();
  private readonly transport = new PcmFrameBuffer(2048, (frame) =>
    this.callbacks.chunk(frame),
  );

  constructor(private readonly callbacks: Callbacks) {}

  push(frame: Float32Array) {
    if (
      !frame.length ||
      frame.length > 8000 ||
      frame.some((value) => !Number.isFinite(value))
    )
      throw new Error("STT_INVALID_AUDIO");
    for (const sample of frame) this.analyze(sample);
  }

  private analyze(sample: number) {
    const voiced = this.activity.push(sample);
    if (!this.active && !voiced) {
      this.preroll.push(sample);
      return;
    }
    if (!this.active) {
      this.active = true;
      const preroll = this.preroll.take();
      this.samples = preroll.length;
      this.callbacks.start();
      this.transport.push(preroll);
    }
    this.samples += 1;
    if (this.samples > 192000) throw new Error("STT_UTTERANCE_TOO_LONG");
    this.transport.pushSample(sample);
    this.silentSamples = voiced ? 0 : this.silentSamples + 1;
    // Preserve the previous effective 768 ms pause tolerance. Do not shorten
    // pauses to make a single recording appear faster.
    if (this.silentSamples >= 12288) {
      this.transport.flush();
      this.callbacks.finish();
      this.active = false;
      this.samples = this.silentSamples = 0;
    }
  }
}
