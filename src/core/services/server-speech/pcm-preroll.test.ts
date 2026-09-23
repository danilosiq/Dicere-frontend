import { expect, it } from "vitest";
import { PcmPreroll } from "./pcm-preroll";

it("retains only the last 4096 samples in chronological order", () => {
  const preroll = new PcmPreroll();
  for (let i = 0; i < 10000; i++) preroll.push(i);
  expect(Array.from(preroll.take())).toEqual(
    Array.from({ length: 4096 }, (_, i) => 5904 + i),
  );
  expect(preroll.take()).toHaveLength(0);
});

it("never pads a short history or reuses a previous utterance", () => {
  const preroll = new PcmPreroll();
  preroll.push(1);
  preroll.push(2);
  expect(Array.from(preroll.take())).toEqual([1, 2]);
  preroll.push(3);
  expect(Array.from(preroll.take())).toEqual([3]);
});
