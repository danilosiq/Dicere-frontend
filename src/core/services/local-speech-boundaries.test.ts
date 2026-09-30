import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalSpeechSegmenter } from "./local-speech-segmenter";

function collect(
  pcm: Float32Array,
  rate: number,
  packet: number,
  first = packet,
) {
  const segmenter = new LocalSpeechSegmenter(rate);
  const result: Float32Array[] = [];
  for (let offset = 0; offset < pcm.length;) {
    const end = Math.min(offset + (offset ? packet : first), pcm.length);
    result.push(...segmenter.push(pcm.subarray(offset, end)));
    offset = end;
  }
  return result;
}

function fingerprint(chunks: Float32Array[]) {
  return chunks.map((chunk) => ({
    samples: chunk.length,
    sha256: createHash("sha256")
      .update(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength))
      .digest("hex"),
  }));
}

describe("local speech packet boundaries", () => {
  it("counts quiet sustained activity across zero crossings, not instantaneous amplitude", () => {
    const pcm = new Float32Array(32000);
    for (let i = 8000; i < 12800; i++)
      pcm[i] = 0.015 * Math.sin((i * Math.PI) / 16);
    expect(collect(pcm, 16000, 2048)).toHaveLength(1);
  });
  it("does not depend on timers and rejects invalid sample rates/audio", () => {
    for (const rate of [0, NaN, Infinity, 7999, 192001, 16000.5])
      expect(() => new LocalSpeechSegmenter(rate)).toThrow(
        "InvalidSpeechSampleRate",
      );
    const segmenter = new LocalSpeechSegmenter(16000);
    expect(segmenter.push(new Float32Array())).toEqual([]);
    expect(() => segmenter.push(new Float32Array([0, NaN]))).toThrow(
      "InvalidSpeechAudio",
    );
    expect(segmenter.push(new Float32Array(16000 * 60))).toEqual([]);
  });
  it.each([16000, 44100, 48000])(
    "keeps identical audio at %i Hz regardless of packets/phase",
    (rate) => {
      const pcm = new Float32Array(rate * 4);
      pcm.fill(0.1, rate, rate * 2);
      pcm.fill(0.1, Math.round(rate * 2.3), rate * 3);
      const expected = fingerprint(collect(pcm, rate, 128));
      expect(expected).toHaveLength(1);
      for (const packet of [256, 512, 1024, 2048, 4096]) {
        for (const first of [1, 127, packet]) {
          expect(fingerprint(collect(pcm, rate, packet, first))).toEqual(
            expected,
          );
        }
      }
    },
  );

  it("keeps the existing bounded cutoff without dropping/duplicating voiced samples", () => {
    const pcm = new Float32Array(16000 * 19);
    for (let i = 0; i < 16000 * 18; i++) pcm[i] = 0.05 + (i % 173) / 10000;
    const chunks = collect(pcm, 16000, 2048);
    expect(chunks).toHaveLength(3);
    expect(chunks.slice(0, 2).map((c) => c.length)).toEqual([129024, 129024]);
    const combined = new Float32Array(
      chunks.reduce((sum, c) => sum + c.length, 0),
    );
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }
    expect(fingerprint([combined.slice(0, 16000 * 18)])).toEqual(
      fingerprint([pcm.slice(0, 16000 * 18)]),
    );
  });

  it("returns both phrases when a packet contains multiple endpoints", () => {
    const pcm = new Float32Array(16000 * 4);
    pcm.fill(0.1, 16000 * 0.4, 16000);
    pcm.fill(0.1, 16000 * 2, 16000 * 2.6);
    expect(fingerprint(collect(pcm, 16000, pcm.length))).toEqual(
      fingerprint(collect(pcm, 16000, 128)),
    );
    expect(collect(pcm, 16000, pcm.length)).toHaveLength(2);
  });
});
