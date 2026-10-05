import { enInterface } from "./interface/en";
import { esInterface } from "./interface/es";
import { zhInterface } from "./interface/zh";
import { enErrors } from "./errors/en";
import { esErrors } from "./errors/es";
import { zhErrors } from "./errors/zh";
import type { SiteLocale } from "./locales";
import type { MessageKey, TranslationValues } from "./types";

export const dictionaries = {
  en: { ...enInterface, ...enErrors },
  es: { ...esInterface, ...esErrors },
  "zh-CN": { ...zhInterface, ...zhErrors },
};

function interpolate(text: string, values: TranslationValues) {
  return text.replace(/\{(\w+)\}/g, (token, key: string) =>
    values[key] === undefined ? token : String(values[key]),
  );
}

export function translate(
  locale: SiteLocale,
  key: MessageKey,
  values: TranslationValues = {},
) {
  const text = locale === "pt-BR" ? key : dictionaries[locale][key];
  return interpolate(text, values);
}

const templates = Object.keys(dictionaries.en)
  .filter((key) => key.includes("{"))
  .map((key) => {
    const names: string[] = [];
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = escaped.replace(/\\\{(\w+)\\\}/g, (_, name: string) => {
      names.push(name);
      return "(.+?)";
    });
    return {
      key: key as MessageKey,
      names,
      pattern: new RegExp(`^${pattern}$`),
    };
  });

/** Only application feedback belongs here, never chat content or room titles. */
export function translateFeedback(locale: SiteLocale, message: string) {
  if (Object.hasOwn(dictionaries.en, message))
    return translate(locale, message as MessageKey);
  for (const { key, names, pattern } of templates) {
    const match = pattern.exec(message);
    if (match)
      return translate(
        locale,
        key,
        Object.fromEntries(names.map((name, i) => [name, match[i + 1]])),
      );
  }
  // Unknown server/browser details are not a localized UI contract.
  return locale === "pt-BR"
    ? message
    : translate(
        locale,
        "Não foi possível concluir a operação. Tente novamente.",
      );
}
