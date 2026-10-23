import { describe, expect, it, vi } from "vitest";
import { LocalSpeechVad, type SpeechProbability } from "./local-speech-vad";

function detector(probabilities: number[]) {
  let index = 0;
  const infer = vi
    .fn<SpeechProbability>()
    .mockImplementation(async () => probabilities[index++] ?? 0);
  return { vad: new LocalSpeechVad(infer), infer };
}

describe("local neural speech admission", () => {
  it("rejects repeated isolated transients even when their total exceeds 250ms", async () => {
    const probabilities = Array.from({ length: 60 }, (_, i) =>
      i % 3 === 0 ? 0.99 : 0.01,
    );
    const { vad } = detector(probabilities);
    expect(await vad.hasSpeech(new Float32Array(512 * 60))).toBe(false);
  });

  it("requires sustained speech rather than a single confident clap", async () => {
    const { vad } = detector([0, 0.99, 0.99, 0.99, 0.99, 0, 0]);
    expect(await vad.hasSpeech(new Float32Array(512 * 7))).toBe(false);
  });

  it("admits a short sustained phrase without changing its PCM", async () => {
    const { vad, infer } = detector(Array(8).fill(0.9));
    const audio = new Float32Array(512 * 9).fill(0.02);
    const original = audio.slice();
    expect(await vad.hasSpeech(audio)).toBe(true);
    expect(audio).toEqual(original);
    expect(infer).toHaveBeenCalledTimes(8);
    expect(infer.mock.calls[0][0]).toHaveLength(512);
    expect(infer.mock.calls[0][1]).toBe(true);
    expect(infer.mock.calls[1][1]).toBe(false);
  });

  it("resets recurrent state for every segment, including after rejection", async () => {
    const { vad, infer } = detector([0, 0]);
    await vad.hasSpeech(new Float32Array(512));
    await vad.hasSpeech(new Float32Array(512));
    expect(infer.mock.calls.map((call) => call[1])).toEqual([true, true]);
  });

  it("zero-pads the final frame and does not count padding as speech", async () => {
    const { vad, infer } = detector(Array(8).fill(0.9));
    expect(await vad.hasSpeech(new Float32Array(512 * 7 + 1).fill(0.1))).toBe(
      false,
    );
    expect(infer.mock.calls[7][0][0]).toBeCloseTo(0.1);
    expect(infer.mock.calls[7][0][1]).toBe(0);
  });

  it("rejects malformed or oversized audio before inference", async () => {
    const { vad, infer } = detector([]);
    for (const audio of [
      new Float32Array([NaN]),
      new Float32Array([Infinity]),
      new Float32Array(16000 * 9),
    ])
      await expect(vad.hasSpeech(audio)).rejects.toThrow("InvalidSpeechAudio");
    expect(await vad.hasSpeech(new Float32Array())).toBe(false);
    expect(infer).not.toHaveBeenCalled();
  });

  it.each([NaN, Infinity, -0.1, 1.1])(
    "rejects invalid model probability %s",
    async (probability) => {
      const { vad } = detector([probability]);
      await expect(vad.hasSpeech(new Float32Array(512))).rejects.toThrow(
        "InvalidSpeechProbability",
      );
    },
  );

  it("accepts the bounded resampled output of an 8kHz capture device", async () => {
    const { vad } = detector([]);
    expect(await vad.hasSpeech(new Float32Array(131072))).toBe(false);
  });
});
