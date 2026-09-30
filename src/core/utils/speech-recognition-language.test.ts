import { describe, expect, it } from "vitest";

import {
  isSpeechSourceLanguageSupported,
  speechSourceLanguageMessage,
} from "./speech-recognition-language";

describe("speech source language support", () => {
  it("accepts only the validated PT-BR source in the first release", () => {
    expect(isSpeechSourceLanguageSupported("PT-BR")).toBe(true);
    expect(isSpeechSourceLanguageSupported("DE")).toBe(false);
    expect(isSpeechSourceLanguageSupported("EN-US")).toBe(false);
  });

  it("explains the limitation without silently changing the source language", () => {
    expect(speechSourceLanguageMessage("DE")).toContain("Selecione PT-BR");
    expect(speechSourceLanguageMessage("DE")).toContain("DE");
  });
});
