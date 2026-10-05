"use client";

import { SelectorCountry } from "./selector-country";
import type { DeepLTargetLanguage } from "./selector-country";
import { useSiteLanguage } from "@/core/i18n/provider";
import type { SiteLocale } from "@/core/i18n/locales";

const SITE_TO_CONVERSATION: Record<SiteLocale, DeepLTargetLanguage> = {
  "pt-BR": "PT-BR",
  en: "EN",
  es: "ES",
  "zh-CN": "ZH-HANS",
};
const CONVERSATION_TO_SITE: Partial<Record<DeepLTargetLanguage, SiteLocale>> = {
  "PT-BR": "pt-BR",
  EN: "en",
  ES: "es",
  "ZH-HANS": "zh-CN",
};

export function SiteLanguageSelector() {
  const { locale, setLocale, t } = useSiteLanguage();
  return (
    <div className="w-48 shrink-0">
      <SelectorCountry
        ariaLabel={t("Idioma do site")}
        value={SITE_TO_CONVERSATION[locale]}
        onSelect={(language) => {
          const siteLocale = CONVERSATION_TO_SITE[language];
          if (siteLocale) setLocale(siteLocale);
        }}
      />
    </div>
  );
}
