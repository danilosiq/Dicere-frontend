export function assertAudioClockAdvances(before, after) {
  const valid = (snapshot) =>
    snapshot?.state === "running" &&
    snapshot.live === true &&
    Number.isFinite(snapshot.currentTime) &&
    snapshot.currentTime >= 0;
  if (
    !valid(before) ||
    !valid(after) ||
    after.currentTime <= before.currentTime
  )
    throw new Error("TEST_AUDIO_CLOCK_NOT_ADVANCING");
}

export async function verifyAudioClock(page) {
  const snapshot = () =>
    page.evaluate(() => {
      const fixture = window.dicereFixture;
      if (!fixture) return null;
      const tracks = fixture.destination.stream.getAudioTracks();
      return {
        state: fixture.context.state,
        currentTime: fixture.context.currentTime,
        live:
          tracks.length > 0 &&
          tracks.every((track) => track.enabled && track.readyState === "live"),
      };
    });
  const before = await snapshot();
  await page.waitForTimeout(250);
  assertAudioClockAdvances(before, await snapshot());
}
