import type * as Flags from "country-flag-icons/react/3x2";

import type { DEEPL_TARGET_LANGUAGES } from "./countryList";

export type DeepLTargetLanguage = (typeof DEEPL_TARGET_LANGUAGES)[number];

export type CountryOption = {
  label: DeepLTargetLanguage;
  flag: keyof typeof Flags;
};

export type SelectorCountryProps = {
  value?: DeepLTargetLanguage;
  defaultValue?: DeepLTargetLanguage;
  placeholder?: string;
  hideLabelText?: boolean;
  disabled?: boolean;
  className?: string;
  onSelect: (language: DeepLTargetLanguage) => void;
};
