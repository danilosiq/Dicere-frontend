import { describe, expect, it } from "vitest";
import { assertAudioClockAdvances } from "./audio-clock.mjs";

const before = { state: "running", currentTime: 1, live: true };
describe("browser fixture audio clock", () => {
  it("allows a running fixture whose audio clock advanced", () => {
    expect(() =>
      assertAudioClockAdvances(before, { ...before, currentTime: 1.2 }),
    ).not.toThrow();
  });
  it.each([
    { ...before },
    { ...before, currentTime: 0.9 },
    { ...before, currentTime: Number.NaN },
    { ...before, currentTime: 1.2, state: "suspended" },
    { ...before, currentTime: 1.2, live: false },
    null,
  ])("rejects a stopped, suspended or stalled executor: %j", (after) => {
    expect(() => assertAudioClockAdvances(before, after)).toThrow(
      "TEST_AUDIO_CLOCK_NOT_ADVANCING",
    );
  });
  it("requires a valid starting snapshot too", () => {
    expect(() =>
      assertAudioClockAdvances(null, { ...before, currentTime: 1.2 }),
    ).toThrow("TEST_AUDIO_CLOCK_NOT_ADVANCING");
  });
});
