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
 * All selector languages can use the multilingual local recognizer. This is
 * availability, not a claim that every language passes the quality/SLA gates.
 * The server recognizer supports PT-BR, EN, ES and ZH independently.
 */
export const SUPPORTED_SPEECH_SOURCE_LANGUAGES = Object.keys(
  SPEECH_RECOGNITION_LOCALES,
) as DeepLTargetLanguage[];

export function isSpeechSourceLanguageSupported(language: DeepLTargetLanguage) {
  return Object.hasOwn(SPEECH_RECOGNITION_LOCALES, language);
}

export function speechSourceLanguageMessage(language: DeepLTargetLanguage) {
  return `O idioma de voz ${language} não é reconhecido. Selecione um idioma disponível em “Idioma falado”.`;
}

export function toSpeechRecognitionLocale(language: DeepLTargetLanguage) {
  return SPEECH_RECOGNITION_LOCALES[language];
}

export function getDefaultSpeechLanguage(): DeepLTargetLanguage {
  // Preserve the existing initial selection; users can select other sources.
  return "PT-BR";
}
