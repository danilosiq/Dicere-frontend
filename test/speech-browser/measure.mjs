import { calibrateClock } from "./microphone-fixture.mjs";
import { verifyAudioClock } from "./audio-clock.mjs";

const words = (text) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.join(" ") || "";

export function summarizeRun(run, reference, earliestSpeechEndSample) {
  const transcript = run.translations
    .map((item) => item.originalText)
    .join(" ");
  const last = run.rendered.at(-1);
  const upperBoundMs = last
    ? last.at +
      run.receiverClock.offset -
      run.scheduled.start -
      run.senderClock.offset -
      earliestSpeechEndSample / 16 +
      run.scheduled.uncertaintyMs +
      run.receiverClock.uncertainty +
      run.senderClock.uncertainty
    : null;
  return {
    exactWords: words(transcript) === words(reference),
    segments: run.translations.length,
    upperBoundMs,
    withinBudget:
      upperBoundMs !== null && upperBoundMs >= 0 && upperBoundMs <= 4000,
  };
}

export async function measure(
  clients,
  sender,
  encoded,
  reference,
  earliestSpeechEndSample,
) {
  const receiver = 1 - sender;
  const source = clients[sender];
  const target = clients[receiver];
  const retry = source.page.getByRole("button", {
    name: "Não foi possível acompanhar a transcrição. Tente novamente.",
    exact: true,
  });
  const recovered = (await retry.count()) > 0;
  if (recovered) {
    await retry.click();
    await source.page.waitForTimeout(500);
  }
  // A sleeping executor can keep JS alive while the audio clock is stalled.
  // Fail explicitly before replay instead of interpreting silence as STT loss.
  await verifyAudioClock(source.page);
  const before = target.translations.length;
  const beforeRender = target.rendered.length;
  const clocks = await Promise.all(
    clients.map(({ page }) => calibrateClock(page)),
  );
  const scheduled = await source.page.evaluate(
    (data) => window.playDicereFixture(data),
    encoded,
  );
  // Retain late arrivals and failures, not just the first successful subtitle.
  await source.page.waitForTimeout(scheduled.durationMs + 6500);
  const run = {
    target: process.env.SPEECH_TEST_TARGET_LANGUAGE || "unknown",
    recovered,
    translations: target.translations.slice(before),
    rendered: target.rendered.slice(beforeRender),
    scheduled,
    senderClock: clocks[sender],
    receiverClock: clocks[receiver],
  };
  return { ...run, ...summarizeRun(run, reference, earliestSpeechEndSample) };
}
