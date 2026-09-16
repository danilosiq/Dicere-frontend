/** Owns only the STT stream, never the WebRTC call stream. */
export class SpeechMicrophone {
  private stopped = false;
  private context?: AudioContext;
  private stream?: MediaStream;
  private source?: MediaStreamAudioSourceNode;
  private processor?: AudioWorkletNode;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly onFrame: (frame: Float32Array) => void,
    private readonly onError: (code: string) => void,
  ) {}

  async start() {
    if (
      !window.isSecureContext ||
      typeof AudioContext === "undefined" ||
      typeof AudioWorkletNode === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    )
      throw new Error("STT_BROWSER_UNSUPPORTED");
    this.context = new AudioContext({ sampleRate: 16000 });
    if (this.context.sampleRate !== 16000)
      throw new Error("STT_SAMPLE_RATE_UNSUPPORTED");
    this.timer = setTimeout(() => {
      this.stop();
      this.onError("STT_MICROPHONE_TIMEOUT");
    }, 60000);
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        channelCount: 1,
      },
      video: false,
    });
    if (this.stopped) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    this.stream = stream;
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => this.onError("STT_MICROPHONE_ENDED");
    });
    await this.context.audioWorklet.addModule("/audio/dicere-pcm-processor.js");
    if (this.stopped) return;
    await this.context.resume();
    if (this.stopped) return;
    this.source = this.context.createMediaStreamSource(stream);
    this.processor = new AudioWorkletNode(this.context, "dicere-pcm");
    this.processor.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
      if (!this.stopped) this.onFrame(data);
    };
    this.processor.onprocessorerror = () =>
      this.onError("STT_AUDIO_PROCESSOR_FAILED");
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
    clearTimeout(this.timer);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    this.processor?.port.close();
    this.processor?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => {
      track.onended = null;
      track.stop();
    });
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => undefined);
  }
}
