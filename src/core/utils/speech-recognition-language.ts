import type { DeepLTargetLanguage } from "@/core/components";

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

/**
 * The first production speech release is validated only for Brazilian
 * Portuguese. Destination languages remain independent and are still handled
 * by the translation service.
 */
export const SUPPORTED_SPEECH_SOURCE_LANGUAGES = ["PT-BR"] as const;

export function isSpeechSourceLanguageSupported(language: DeepLTargetLanguage) {
  return language === SUPPORTED_SPEECH_SOURCE_LANGUAGES[0];
}

export function speechSourceLanguageMessage(language: DeepLTargetLanguage) {
  return `A transcrição de voz em ${language} ainda não está disponível. Selecione PT-BR em “Idioma falado”.`;
}

export function toSpeechRecognitionLocale(language: DeepLTargetLanguage) {
  return SPEECH_RECOGNITION_LOCALES[language];
}

export function getDefaultSpeechLanguage(): DeepLTargetLanguage {
  // PT-BR is the only speech source validated for the first release. Do not
  // infer an unsupported browser language and start the low-quality fallback.
  return "PT-BR";
}
