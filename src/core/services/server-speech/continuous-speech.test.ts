import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { StreamingSegmenter } from "./segmenter";
import { capturePolicy } from "./capture-policy";

function capture(audio: Float32Array, sizes = [2048], locale = "pt-BR") {
  const segments: Float32Array[][] = [];
  let current: Float32Array[] = [];
  const segmenter = new StreamingSegmenter(
    {
      start: () => {
        current = [];
      },
      chunk: (frame) => current.push(frame),
      finish: () => segments.push(current),
    },
    capturePolicy(locale),
  );
  for (let offset = 0, packet = 0; offset < audio.length; packet++) {
    const end = Math.min(audio.length, offset + sizes[packet % sizes.length]);
    segmenter.push(audio.subarray(offset, end));
    offset = end;
  }
  return segments.map((chunks) => {
    const pcm = new Float32Array(
      chunks.reduce((sum, chunk) => sum + chunk.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }
    return pcm;
  });
}

const hash = (audio: Float32Array) =>
  createHash("sha256")
    .update(Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength))
    .digest("hex");

describe("continuous server speech", () => {
  it.each(
    ["pt-BR", "en-US", "en-GB", "es-ES", "zh-CN"].flatMap((locale) =>
      [13, 31, 65].map((seconds) => ({ locale, seconds })),
    ),
  )(
    "keeps $locale listening throughout $seconds seconds with bounded captures",
    ({ locale, seconds }) => {
      const spokenSamples = seconds * 16000;
      const audio = new Float32Array(spokenSamples + 16000);
      for (let i = 0; i < spokenSamples; i++) audio[i] = 0.1 + (i % 31) / 1000;
      const segments = capture(audio, [2048], locale);
      const maxSamples = capturePolicy(locale).maxSamples;
      expect(segments.length).toBe(Math.ceil((seconds * 16000) / maxSamples));
      expect(
        Math.max(...segments.map((segment) => segment.length)),
      ).toBeLessThanOrEqual(maxSamples);
      const received = new Float32Array(
        segments.reduce((sum, segment) => sum + segment.length, 0),
      );
      let offset = 0;
      for (const segment of segments) {
        received.set(segment, offset);
        offset += segment.length;
      }
      // Every voiced sample, including the seam, arrives exactly once and in order.
      expect(hash(received.subarray(0, spokenSamples))).toBe(
        hash(audio.subarray(0, spokenSamples)),
      );
      expect(
        received.subarray(spokenSamples).every((sample) => sample === 0),
      ).toBe(true);
    },
  );

  it("uses a short natural pause after eight seconds before reaching the hard boundary", () => {
    const audio = new Float32Array(26 * 16000);
    audio.fill(0.1, 0, 9 * 16000);
    audio.fill(0.2, 9 * 16000 + 4800, 25 * 16000);
    const segments = capture(audio);
    expect(segments.length).toBeGreaterThanOrEqual(3);
    expect(segments[0].length).toBeGreaterThan(9 * 16000);
    expect(segments[0].length).toBeLessThan(9 * 16000 + 4800);
    expect(segments[0].slice(-3200).every((sample) => sample === 0)).toBe(true);
    expect(segments[1].some((sample) => sample > 0 && sample < 0.15)).toBe(
      false,
    );
  });

  it("keeps rollover boundaries independent of packet size and starting phase", () => {
    const audio = new Float32Array(32 * 16000);
    audio.fill(0.1, 0, 31 * 16000);
    const expected = capture(audio).map(hash);
    for (const sizes of [[128], [8000], [1, 255, 4097, 37, 1024]])
      expect(capture(audio, sizes).map(hash)).toEqual(expected);
  });

  it("does not create a silence-only capture after an exact twelve-second boundary", () => {
    const callbacks = { start: vi.fn(), chunk: vi.fn(), finish: vi.fn() };
    const segmenter = new StreamingSegmenter(callbacks);
    for (let i = 0; i < 24; i++)
      segmenter.push(new Float32Array(8000).fill(0.1));
    for (let i = 0; i < 8; i++) segmenter.push(new Float32Array(8000));
    expect(callbacks.finish).toHaveBeenCalledOnce();
    expect(callbacks.start).toHaveBeenCalledOnce();
  });
});
