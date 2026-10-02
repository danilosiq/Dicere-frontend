import { describe, expect, it } from "vitest";
import { validateFixtureAudio } from "./fixture-audio.mjs";

describe("browser fixture audio validation", () => {
  it.each([13, 31, 65, 120])(
    "accepts %s second recordings independently of the API capture limit",
    (seconds) => {
      expect(() =>
        validateFixtureAudio(Buffer.alloc(seconds * 32000), seconds * 16000),
      ).not.toThrow();
    },
  );
  it.each([
    [0, 1],
    [3, 1],
    [3840002, 1],
    [32000, 0],
    [32000, 16001],
    [32000, 1.5],
  ])(
    "rejects invalid or oversized fixtures (%s bytes, end %s)",
    (bytes, end) => {
      expect(() => validateFixtureAudio(Buffer.alloc(bytes), end)).toThrow(
        "INVALID_PRIVATE_PCM_FIXTURE",
      );
    },
  );
});
