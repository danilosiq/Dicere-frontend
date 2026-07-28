import type { DeepLTargetLanguage } from "@/core/components";
import { isDeepLTargetLanguage } from "@/core/components/selector-country/countryList";

const SPEECH_RECOGNITION_LOCALES: Record<DeepLTargetLanguage, string> = {
  BG: "bg-BG",
  CS: "cs-CZ",
  DA: "da-DK",
  DE: "de-DE",
  EL: "el-GR",
  EN: "en-US",
  "EN-GB": "en-GB",
  "EN-US": "en-US",
  ES: "es-ES",
  ET: "et-EE",
  FI: "fi-FI",
  FR: "fr-FR",
  HU: "hu-HU",
  ID: "id-ID",
  IT: "it-IT",
  JA: "ja-JP",
  KO: "ko-KR",
  LT: "lt-LT",
  LV: "lv-LV",
  NB: "nb-NO",
  NL: "nl-NL",
  PL: "pl-PL",
  PT: "pt-PT",
  "PT-BR": "pt-BR",
  "PT-PT": "pt-PT",
  RO: "ro-RO",
  RU: "ru-RU",
  SK: "sk-SK",
  SL: "sl-SI",
  SV: "sv-SE",
  TR: "tr-TR",
  UK: "uk-UA",
  ZH: "zh-CN",
  "ZH-HANS": "zh-CN",
};

export function toSpeechRecognitionLocale(language: DeepLTargetLanguage) {
  return SPEECH_RECOGNITION_LOCALES[language];
}

export function getDefaultSpeechLanguage(): DeepLTargetLanguage {
  if (typeof navigator === "undefined") return "PT-BR";

  const browserLanguage = navigator.language.toUpperCase();
  if (isDeepLTargetLanguage(browserLanguage)) return browserLanguage;

  const baseLanguage = browserLanguage.split("-")[0];
  if (isDeepLTargetLanguage(baseLanguage)) return baseLanguage;

  return "PT-BR";
}
