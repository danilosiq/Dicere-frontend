import type * as Flags from "country-flag-icons/react/3x2";

type CountryCode = keyof typeof Flags;

export const DEEPL_TARGET_LANGUAGES = [
  "BG",
  "CS",
  "DA",
  "DE",
  "EL",
  "EN",
  "EN-GB",
  "EN-US",
  "ES",
  "ET",
  "FI",
  "FR",
  "HU",
  "ID",
  "IT",
  "JA",
  "KO",
  "LT",
  "LV",
  "NB",
  "NL",
  "PL",
  "PT",
  "PT-BR",
  "PT-PT",
  "RO",
  "RU",
  "SK",
  "SL",
  "SV",
  "TR",
  "UK",
  "ZH",
  "ZH-HANS",
] as const;

export function isDeepLTargetLanguage(
  value: unknown,
): value is (typeof DEEPL_TARGET_LANGUAGES)[number] {
  return (
    typeof value === "string" &&
    DEEPL_TARGET_LANGUAGES.some((language) => language === value)
  );
}

export const COUNTRY_LIST = [
  { label: "PT-BR", flag: "BR", name: "Português" },
  { label: "EN", flag: "US", name: "Inglês" },
  { label: "ES", flag: "ES", name: "Espanhol" },
  { label: "ZH-HANS", flag: "CN", name: "Chinês" },
] as const satisfies ReadonlyArray<{
  label: (typeof DEEPL_TARGET_LANGUAGES)[number];
  flag: CountryCode;
  name: string;
}>;
