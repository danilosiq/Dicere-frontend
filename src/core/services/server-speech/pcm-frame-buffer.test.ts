import { expect, it } from "vitest";
import { PcmFrameBuffer } from "./pcm-frame-buffer";

it("preserves order and remainder across uneven input packets", () => {
  const frames: Float32Array[] = [];
  const buffer = new PcmFrameBuffer(4, (frame) => frames.push(frame));
  buffer.push(new Float32Array([1, 2, 3]));
  expect(frames).toHaveLength(0);
  buffer.push(new Float32Array([4, 5, 6, 7, 8, 9]));
  expect(frames.map((frame) => Array.from(frame))).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
  ]);
  buffer.flush();
  buffer.flush();
  expect(frames.map((frame) => Array.from(frame))).toEqual([
    [1, 2, 3, 4],
    [5, 6, 7, 8],
    [9],
  ]);
});

it("does not mutate emitted frames or retain caller-owned input", () => {
  const frames: Float32Array[] = [];
  const buffer = new PcmFrameBuffer(4, (frame) => frames.push(frame));
  const input = new Float32Array([1, 2]);
  buffer.push(input);
  input.fill(9);
  buffer.push(new Float32Array([3, 4, 5, 6, 7, 8]));
  expect(Array.from(frames[0])).toEqual([1, 2, 3, 4]);
});
