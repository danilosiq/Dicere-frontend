import { describe, expect, it } from "vitest";
import { capturePolicy } from "./capture-policy";

describe("capture policy by recognition engine", () => {
  it.each(["en-US", "en-GB", "es-ES"])(
    "bounds the slower %s decoder without extending its timeout",
    (locale) => {
      expect(capturePolicy(locale)).toEqual({
        softSamples: 4 * 16000,
        maxSamples: 6 * 16000,
      });
    },
  );
  it.each(["pt-BR", "zh-CN"])(
    "keeps the existing %s per-capture ceiling",
    (locale) => {
      expect(capturePolicy(locale)).toEqual({
        softSamples: 8 * 16000,
        maxSamples: 12 * 16000,
      });
    },
  );
});
