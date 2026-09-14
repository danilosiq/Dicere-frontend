import { describe, expect, it } from "vitest";
import { LocalSpeechSegmenter } from "./local-speech-segmenter";

function feed(
  segmenter: LocalSpeechSegmenter,
  count: number,
  amplitude: number,
  frameSize = 1600,
) {
  const outputs: Float32Array[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = segmenter.push(new Float32Array(frameSize).fill(amplitude));
    if (result) outputs.push(result);
  }
  return outputs;
}

describe("LocalSpeechSegmenter", () => {
  it("does not transcribe silence or short clicks", () => {
    const segmenter = new LocalSpeechSegmenter(16000);
    expect(feed(segmenter, 1000, 0)).toEqual([]);
    expect(feed(segmenter, 1, 0.1)).toEqual([]);
    expect(feed(segmenter, 10, 0)).toEqual([]);
  });

  it("emits a phrase after silence, preserving pre-roll", () => {
    const segmenter = new LocalSpeechSegmenter(16000);
    feed(segmenter, 10, 0);
    expect(feed(segmenter, 10, 0.1)).toEqual([]);
    const result = feed(segmenter, 7, 0);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(30400);
    expect(result[0][0]).toBe(0);
    expect(result[0][3200]).toBeCloseTo(0.1);
    expect(feed(segmenter, 20, 0)).toEqual([]);
  });

  it("bounds continuous speech to six-second chunks", () => {
    const result = feed(new LocalSpeechSegmenter(16000), 180, 0.1);
    expect(result).toHaveLength(3);
    expect(result.every((chunk) => chunk.length === 96000)).toBe(true);
  });

  it("resamples a 48kHz device to the model's 16kHz input", () => {
    const result = feed(new LocalSpeechSegmenter(48000), 60, 0.1, 4800);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(96000);
    expect(result[0][1000]).toBeCloseTo(0.1);
  });
});
