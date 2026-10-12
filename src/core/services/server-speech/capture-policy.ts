export type CapturePolicy = Readonly<{
  softSamples: number;
  maxSamples: number;
}>;

const shorterCapture: CapturePolicy = {
  softSamples: 2 * 16000,
  maxSamples: 6 * 16000,
};

/** Each decoder language uses the same short capture budget. The locale
 * argument remains accepted for existing call sites and language-aware tests. */
export function capturePolicy(locale: string): CapturePolicy {
  void locale;
  return shorterCapture;
}
