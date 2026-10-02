export type CapturePolicy = Readonly<{
  softSamples: number;
  maxSamples: number;
}>;

const normalCapture: CapturePolicy = {
  softSamples: 8 * 16000,
  maxSamples: 12 * 16000,
};
const shorterCapture: CapturePolicy = {
  softSamples: 4 * 16000,
  maxSamples: 6 * 16000,
};

/** Canary EN/ES decoding of long captures exceeds the existing inference
 * deadline on the VPS. Bound work per capture, not total speaking time. */
export function capturePolicy(locale: string): CapturePolicy {
  return ["en-US", "en-GB", "es-ES"].includes(locale)
    ? shorterCapture
    : normalCapture;
}
