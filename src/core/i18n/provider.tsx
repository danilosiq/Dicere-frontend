"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import {
  getPreferredSiteLocale,
  isSiteLocale,
  SITE_LOCALE_STORAGE_KEY,
  type SiteLocale,
} from "./locales";
import { translate, translateFeedback } from "./translate";
import type { MessageKey, TranslationValues } from "./types";

type SiteLanguage = {
  locale: SiteLocale;
  setLocale: (locale: SiteLocale) => void;
  t: (key: MessageKey, values?: TranslationValues) => string;
  feedback: (message: string) => string;
};

const SiteLanguageContext = createContext<SiteLanguage>({
  locale: "pt-BR",
  setLocale: () => {},
  t: (key, values) => translate("pt-BR", key, values),
  feedback: (message) => message,
});

export function SiteLanguageProvider({ children }: PropsWithChildren) {
  // A deterministic first render avoids hydration mismatches with browser settings.
  const [locale, updateLocale] = useState<SiteLocale>("pt-BR");

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      updateLocale(getPreferredSiteLocale()),
    );
    function handleStorage(event: StorageEvent) {
      if (event.key === SITE_LOCALE_STORAGE_KEY)
        updateLocale(
          isSiteLocale(event.newValue)
            ? event.newValue
            : getPreferredSiteLocale(),
        );
    }
    window.addEventListener("storage", handleStorage);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute(
      "content",
      translate(locale, "Comunicação simples, direta e acessível."),
    );
  }, [locale]);

  const value = useMemo<SiteLanguage>(
    () => ({
      locale,
      setLocale(next) {
        if (!isSiteLocale(next)) return;
        updateLocale(next);
        try {
          localStorage.setItem(SITE_LOCALE_STORAGE_KEY, next);
        } catch {
          /* Keep the in-memory choice when storage is blocked. */
        }
      },
      t: (key, values) => translate(locale, key, values),
      feedback: (message) => translateFeedback(locale, message),
    }),
    [locale],
  );

  return (
    <SiteLanguageContext.Provider value={value}>
      {children}
    </SiteLanguageContext.Provider>
  );
}

export function useSiteLanguage() {
  return useContext(SiteLanguageContext);
}
