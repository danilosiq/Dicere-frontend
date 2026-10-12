import { expect, it } from "vitest";
import { capturePolicy } from "./capture-policy";

it.each(["pt-BR", "en-US", "en-GB", "es-ES", "zh-CN"])(
  "uses an early natural pause and a six-second ceiling for %s",
  (locale) => {
    expect(capturePolicy(locale)).toEqual({
      softSamples: 2 * 16000,
      maxSamples: 6 * 16000,
    });
  },
);
