const transientErrors = new Set([
  "STT_UNAVAILABLE",
  "STT_BUSY",
  "STT_TIMEOUT",
  "STT_ACK_TIMEOUT",
  "STT_DISCONNECTED",
  "STT_BACKPRESSURE",
  "STT_SESSION_NOT_FOUND",
  "STT_SESSION_BUSY",
  "STT_PROCESSING_FAILED",
  "STT_TRANSLATION_FAILED",
  "STT_RECEIVER_UNAVAILABLE",
  "STT_MICROPHONE_ENDED",
  "STT_MICROPHONE_TIMEOUT",
  "STT_MICROPHONE_INTERRUPTED",
  "STT_AUDIO_PROCESSOR_FAILED",
  "STT_AUDIO_SUSPENDED",
  "STT_DEVICE_BUSY",
  "STT_INTERRUPTED",
]);

export function isRecoverableSpeechError(code: string) {
  return transientErrors.has(code);
}

/** Capped frequency, not a permanently exhausted retry budget. */
export function speechRecoveryDelay(attempt: number) {
  return Math.min(30000, 500 * 2 ** Math.min(Math.max(attempt - 1, 0), 6));
}
