import { describe, expect, it } from "vitest";
import { splitSpeechText } from "./speech-translation-service";

const pinocchio = [
  "Pinocchio ist eine lebendige Holzpuppe, die von Geppetto geschnitzt wurde.",
  "Er träumt davon, ein echter Junge zu werden, doch seine Neugier führt ihn immer wieder in Schwierigkeiten.",
  "Auf seinem Weg begegnet er falschen Freunden, lernt die Folgen seiner Lügen kennen und entdeckt, dass Mut, Ehrlichkeit und Liebe ihn seinem Traum näherbringen.",
];

describe("sentence-aware speech splitting", () => {
  it("works without Intl.Segmenter in older browsers", () => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, "Segmenter")!;
    Object.defineProperty(Intl, "Segmenter", {
      ...descriptor,
      value: undefined,
    });
    try {
      expect(splitSpeechText(pinocchio.join(" "))).toEqual([
        pinocchio.slice(0, 2).join(" "),
        pinocchio[2],
      ]);
    } finally {
      Object.defineProperty(Intl, "Segmenter", descriptor);
    }
  });

  it("validates custom limits and makes progress with astral characters", () => {
    for (const limit of [0, 1, 2.5, NaN, Infinity]) {
      expect(() => splitSpeechText("abc", limit)).toThrow(RangeError);
    }
    expect(splitSpeechText("😀😀😀", 2)).toEqual(["😀", "😀", "😀"]);
    expect(splitSpeechText("a".repeat(501))).toEqual([
      "a".repeat(250),
      "a".repeat(250),
      "a",
    ]);
  });
  it("preserves the complete German Pinocchio sentences", () => {
    expect(splitSpeechText(pinocchio.join(" "))).toEqual([
      pinocchio.slice(0, 2).join(" "),
      pinocchio[2],
    ]);
  });

  it("preserves names, numbers, negations and intentional repetition", () => {
    const sentence =
      "João não pagou 3.50 euros. Não, não: Geppetto ainda não voltou!";
    const text = Array(8).fill(sentence).join(" ");
    const chunks = splitSpeechText(text);
    expect(chunks.join(" ")).toBe(text);
    expect(
      chunks.every((chunk) => chunk.length <= 250 && /[.!?]$/.test(chunk)),
    ).toBe(true);
  });

  it("falls back to words for a sentence longer than the API limit", () => {
    const text =
      "Esta frase não termina " +
      "porque continuamos falando ".repeat(30) +
      "até aqui.";
    const chunks = splitSpeechText(text);
    expect(chunks.join(" ")).toBe(text);
    expect(
      chunks.every((chunk) => chunk.length <= 250 && chunk.length > 0),
    ).toBe(true);
  });

  it("never splits a surrogate pair, even in a long word", () => {
    const text = "a" + "😀".repeat(300);
    const chunks = splitSpeechText(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => chunk.length <= 250)).toBe(true);
    expect(
      chunks.every(
        (chunk) =>
          !/[\uD800-\uDBFF]$/.test(chunk) && !/^[\uDC00-\uDFFF]/.test(chunk),
      ),
    ).toBe(true);
  });

  it("keeps CJK text unchanged without inserting spaces", () => {
    const text = "ピノキオは正直で勇敢な子になりたいと思っています。".repeat(
      24,
    );
    const chunks = splitSpeechText(text);
    expect(chunks.join("")).toBe(text);
    expect(
      chunks.every((chunk) => chunk.length <= 250 && chunk.endsWith("。")),
    ).toBe(true);
  });

  it("normalizes whitespace and ignores empty input", () => {
    expect(splitSpeechText("  Bom\n dia!\t Como vai?  ")).toEqual([
      "Bom dia! Como vai?",
    ]);
    expect(splitSpeechText(" \n ")).toEqual([]);
  });
});
