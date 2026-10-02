import { PcmFrameBuffer } from "./pcm-frame-buffer";
import { SpeechActivityWindow } from "./activity-window";
import { PcmPreroll } from "./pcm-preroll";
import { capturePolicy, type CapturePolicy } from "./capture-policy";

type Callbacks = {
  start: () => void;
  chunk: (frame: Float32Array) => void;
  finish: () => void;
};

const CONTINUATION_PAUSE_SAMPLES = 3200;
const END_PAUSE_SAMPLES = 12288;

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

  constructor(
    private readonly callbacks: Callbacks,
    private readonly policy: CapturePolicy = capturePolicy("pt-BR"),
  ) {}

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
    this.transport.pushSample(sample);
    this.silentSamples = voiced ? 0 : this.silentSamples + 1;
    // Keep the 768 ms natural endpoint for short phrases. Long captures prefer
    // a 200 ms acoustic pause after the soft limit; the engine-specific ceiling
    // (at most the 12 s API limit) closes a capture,
    // never the microphone. No overlapping audio or text-based deduplication.
    const rollover = this.samples >= this.policy.maxSamples;
    const longPause =
      this.samples >= this.policy.softSamples &&
      this.silentSamples >= CONTINUATION_PAUSE_SAMPLES;
    if (rollover || longPause || this.silentSamples >= END_PAUSE_SAMPLES) {
      this.transport.flush();
      this.callbacks.finish();
      this.active = false;
      this.samples = this.silentSamples = 0;
      // Old energy must not open a new silence-only capture immediately after
      // a hard boundary. The preroll retains the next onset while VAD restarts.
      if (rollover) this.activity.reset();
    }
  }
}
