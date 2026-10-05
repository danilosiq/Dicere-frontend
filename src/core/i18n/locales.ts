export const SITE_LOCALES = ["pt-BR", "en", "es", "zh-CN"] as const;
export type SiteLocale = (typeof SITE_LOCALES)[number];
export const SITE_LOCALE_STORAGE_KEY = "dicere-site-locale";

export function isSiteLocale(value: unknown): value is SiteLocale {
  return SITE_LOCALES.some((locale) => locale === value);
}

export function detectSiteLocale(languages: readonly string[]): SiteLocale {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (base === "pt") return "pt-BR";
    if (base === "en" || base === "es") return base;
    if (base === "zh") return "zh-CN";
  }
  return "pt-BR";
}

export function getPreferredSiteLocale(): SiteLocale {
  try {
    const saved = localStorage.getItem(SITE_LOCALE_STORAGE_KEY);
    if (isSiteLocale(saved)) return saved;
  } catch {
    // A blocked storage must not prevent language selection.
  }
  return detectSiteLocale(navigator.languages ?? [navigator.language]);
}
