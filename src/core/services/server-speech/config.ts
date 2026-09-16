export function isServerSpeechEnabled() {
  return process.env.NEXT_PUBLIC_SPEECH_SERVER_ENABLED === "true";
}
