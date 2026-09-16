import { describe, expect, it, vi } from "vitest";
import { StreamingSegmenter } from "./segmenter";

describe("StreamingSegmenter", () => {
  function setup() {
    const callbacks = { start: vi.fn(), chunk: vi.fn(), finish: vi.fn() };
    return { ...callbacks, segmenter: new StreamingSegmenter(callbacks) };
  }
  const voice = () => new Float32Array(2048).fill(0.1);
  const silence = () => new Float32Array(2048);

  it("uploads before the end of speech and preserves preroll", () => {
    const { segmenter, start, chunk, finish } = setup();
    for (let i = 0; i < 100; i++) segmenter.push(silence());
    expect(chunk).not.toHaveBeenCalled();
    segmenter.push(voice());
    expect(start).toHaveBeenCalledOnce();
    expect(chunk).toHaveBeenCalledTimes(3);
    expect(finish).not.toHaveBeenCalled();
    for (let i = 0; i < 5; i++) segmenter.push(silence());
    expect(finish).not.toHaveBeenCalled();
    segmenter.push(silence());
    expect(finish).toHaveBeenCalledOnce();
  });

  it("preserves pauses and continuous phrases beyond six seconds", () => {
    const { segmenter, start, finish } = setup();
    for (let i = 0; i < 30; i++) segmenter.push(voice());
    for (let i = 0; i < 3; i++) segmenter.push(silence());
    for (let i = 0; i < 30; i++) segmenter.push(voice());
    expect(start).toHaveBeenCalledOnce();
    expect(finish).not.toHaveBeenCalled();
  });

  it("fails explicitly at the duration limit instead of clipping words", () => {
    const { segmenter } = setup();
    expect(() => {
      for (let i = 0; i < 100; i++) segmenter.push(voice());
    }).toThrow("STT_UTTERANCE_TOO_LONG");
  });
});
