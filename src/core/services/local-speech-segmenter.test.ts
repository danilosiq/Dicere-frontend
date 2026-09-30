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
    outputs.push(
      ...segmenter.push(new Float32Array(frameSize).fill(amplitude)),
    );
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
    const result = feed(segmenter, 9, 0);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(32768);
    expect(result[0][0]).toBe(0);
    expect(result[0][3712]).toBeCloseTo(0.1);
    expect(feed(segmenter, 20, 0)).toEqual([]);
  });

  it("waits for a short pause after six seconds instead of cutting a word", () => {
    const segmenter = new LocalSpeechSegmenter(16000);
    expect(feed(segmenter, 60, 0.1)).toEqual([]);
    expect(feed(segmenter, 1, 0)).toEqual([]);
    const result = feed(segmenter, 2, 0);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(100352);
  });

  it("bounds continuous speech to eight seconds plus at most one analysis window", () => {
    const result = feed(new LocalSpeechSegmenter(16000), 180, 0.1);
    expect(result).toHaveLength(2);
    expect(result.every((chunk) => chunk.length === 129024)).toBe(true);
  });

  it("resamples a 48kHz device to the model's 16kHz input", () => {
    const result = feed(new LocalSpeechSegmenter(48000), 81, 0.1, 4800);
    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(128341);
    expect(result[0][1000]).toBeCloseTo(0.1);
  });
});
