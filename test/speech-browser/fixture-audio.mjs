// Recording duration is not the per-request limit of the speech API. Keep the
// QA executor bounded while allowing it to exercise rolling captures.
const MAX_FIXTURE_BYTES = 120 * 16000 * 2;

export function validateFixtureAudio(pcm, earliestSpeechEndSample) {
  if (
    !pcm.length ||
    pcm.length % 2 ||
    pcm.length > MAX_FIXTURE_BYTES ||
    !Number.isInteger(earliestSpeechEndSample) ||
    earliestSpeechEndSample <= 0 ||
    earliestSpeechEndSample > pcm.length / 2
  )
    throw new Error("INVALID_PRIVATE_PCM_FIXTURE");
}
