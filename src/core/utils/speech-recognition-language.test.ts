import { describe, expect, it } from "vitest";

import {
  isSpeechSourceLanguageSupported,
  speechSourceLanguageMessage,
  toSpeechRecognitionLocale,
} from "./speech-recognition-language";
import { DEEPL_TARGET_LANGUAGES } from "@/core/components/selector-country/countryList";

describe("speech source language support", () => {
  it.each(DEEPL_TARGET_LANGUAGES)(
    "enables the selected spoken language %s",
    (language) => {
      expect(isSpeechSourceLanguageSupported(language)).toBe(true);
      expect(toSpeechRecognitionLocale(language)).toMatch(
        /^[a-z]{2}-[A-Z]{2}$/,
      );
    },
  );

  it("explains the limitation without silently changing the source language", () => {
    expect(speechSourceLanguageMessage("DE")).not.toContain("Selecione PT-BR");
    expect(speechSourceLanguageMessage("DE")).toContain("DE");
  });
});
