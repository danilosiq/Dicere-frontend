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
  { label: "BG", flag: "BG" },
  { label: "CS", flag: "CZ" },
  { label: "DA", flag: "DK" },
  { label: "DE", flag: "DE" },
  { label: "EL", flag: "GR" },
  { label: "EN", flag: "US" },
  { label: "EN-GB", flag: "GB" },
  { label: "EN-US", flag: "US" },
  { label: "ES", flag: "ES" },
  { label: "ET", flag: "EE" },
  { label: "FI", flag: "FI" },
  { label: "FR", flag: "FR" },
  { label: "HU", flag: "HU" },
  { label: "ID", flag: "ID" },
  { label: "IT", flag: "IT" },
  { label: "JA", flag: "JP" },
  { label: "KO", flag: "KR" },
  { label: "LT", flag: "LT" },
  { label: "LV", flag: "LV" },
  { label: "NB", flag: "NO" },
  { label: "NL", flag: "NL" },
  { label: "PL", flag: "PL" },
  { label: "PT", flag: "PT" },
  { label: "PT-BR", flag: "BR" },
  { label: "PT-PT", flag: "PT" },
  { label: "RO", flag: "RO" },
  { label: "RU", flag: "RU" },
  { label: "SK", flag: "SK" },
  { label: "SL", flag: "SI" },
  { label: "SV", flag: "SE" },
  { label: "TR", flag: "TR" },
  { label: "UK", flag: "UA" },
  { label: "ZH", flag: "CN" },
  { label: "ZH-HANS", flag: "CN" },
] as const satisfies ReadonlyArray<{
  label: (typeof DEEPL_TARGET_LANGUAGES)[number];
  flag: CountryCode;
}>;
