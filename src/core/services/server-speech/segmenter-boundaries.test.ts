import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { StreamingSegmenter } from "./segmenter";

function segment(audio: Float32Array, packetSizes: number[]) {
  const segments: number[][] = [];
  let current: number[] = [];
  const chunks: number[] = [];
  const segmenter = new StreamingSegmenter({
    start: () => {
      current = [];
    },
    chunk: (frame) => {
      current.push(...frame);
      chunks.push(frame.length);
    },
    finish: () => segments.push(current),
  });
  for (let offset = 0, packet = 0; offset < audio.length; packet++) {
    const end = Math.min(
      audio.length,
      offset + packetSizes[packet % packetSizes.length],
    );
    segmenter.push(audio.subarray(offset, end));
    offset = end;
  }
  return { segments, chunks };
}

function fixture() {
  const audio = new Float32Array(64000);
  // Non-zero quiet onset makes accidental preroll loss visible.
  audio.fill(0.001, 12288, 16384);
  audio.fill(0.1, 16384, 20480);
  audio.fill(0.2, 24576, 28672); // A natural 256 ms internal pause.
  audio.fill(0.3, 45056, 49152); // A second independent utterance.
  return audio;
}

const signature = (segments: number[][]) =>
  segments.map((samples) => ({
    length: samples.length,
    hash: createHash("sha256")
      .update(Buffer.from(new Float32Array(samples).buffer))
      .digest("hex"),
  }));

describe("sample-based segmentation boundaries", () => {
  it("preserves identical PCM regardless of transport packet sizes", () => {
    const audio = fixture();
    const expected = segment(audio, [2048]);
    for (const sizes of [[128], [8000], [1, 255, 4097, 37, 1024]])
      expect(signature(segment(audio, sizes).segments)).toEqual(
        signature(expected.segments),
      );
  });

  it("retains quiet onset and pauses without duplicating adjacent utterances", () => {
    const audio = fixture();
    const { segments, chunks } = segment(audio, [8000]);
    expect(signature(segments)).toEqual(
      signature([
        Array.from(audio.subarray(12289, 41215)),
        Array.from(audio.subarray(41215, 61695)),
      ]),
    );
    expect(Math.max(...chunks)).toBeLessThanOrEqual(2048);
    expect(chunks.length).toBeLessThanOrEqual(26);
  });

  it("uses bounded silence buffering and never emits a silence-only segment", () => {
    expect(segment(new Float32Array(160000), [8000]).segments).toEqual([]);
  });

  it("produces identical utterances for arbitrary starting phases", () => {
    const audio = fixture();
    const expected = signature(segment(audio, [2048]).segments);
    for (const shift of [
      1, 17, 127, 128, 255, 256, 511, 928, 1023, 1920, 2047,
    ]) {
      const shifted = new Float32Array(audio.length + shift);
      shifted.set(audio, shift);
      expect(signature(segment(shifted, [2048]).segments)).toEqual(expected);
    }
  });

  it("rejects invalid input before forwarding any part of the packet", () => {
    let starts = 0;
    const segmenter = new StreamingSegmenter({
      start: () => starts++,
      chunk: () => {},
      finish: () => {},
    });
    const frame = new Float32Array(2048).fill(0.1);
    frame[2047] = NaN;
    expect(() => segmenter.push(frame)).toThrow("STT_INVALID_AUDIO");
    expect(starts).toBe(0);
  });
});
