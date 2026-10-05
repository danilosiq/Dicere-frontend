import { describe, expect, it } from "vitest";
import { dictionaries, translate, translateFeedback } from "./translate";
import { detectSiteLocale, isSiteLocale, SITE_LOCALES } from "./locales";
import type { MessageKey } from "./types";
import { formatLocalDateTime } from "@/core/hooks/use-local-date-time";

describe("site locale detection", () => {
  it.each([
    [["en-GB", "pt-BR"], "en"],
    [["es-MX"], "es"],
    [["zh-TW"], "zh-CN"],
    [["pt-PT"], "pt-BR"],
    [["de-DE", "fr-FR", "en-US"], "en"],
    [["de-DE"], "pt-BR"],
    [[], "pt-BR"],
  ])("detects %j as %s", (languages, expected) => {
    expect(detectSiteLocale(languages)).toBe(expected);
  });
  it("rejects invalid saved preferences", () => {
    for (const value of [null, "", "DE", "EN-US", "__proto__", 1])
      expect(isSiteLocale(value)).toBe(false);
  });
});

describe("complete interface dictionaries", () => {
  const keys = Object.keys(dictionaries.en) as MessageKey[];
  it("covers the same keys in every translated locale", () => {
    expect(keys.length).toBeGreaterThan(190);
    for (const dictionary of Object.values(dictionaries))
      expect(Object.keys(dictionary).sort()).toEqual([...keys].sort());
  });
  it("preserves every interpolation token and has no empty translations", () => {
    for (const locale of SITE_LOCALES) {
      for (const key of keys) {
        const result = translate(locale, key);
        expect(result.trim(), `${locale}: ${key}`).not.toBe("");
        expect(
          result.match(/\{\w+\}/g)?.sort() ?? [],
          `${locale}: ${key}`,
        ).toEqual(key.match(/\{\w+\}/g)?.sort() ?? []);
      }
    }
  });
  it("inserts arbitrary names as text without translating them", () => {
    expect(
      translate("en", "Entre novamente como {name} na sala {code}.", {
        name: "Cancelar <João>",
        code: "ABC123",
      }),
    ).toBe("Rejoin room ABC123 as Cancelar <João>.");
  });
  it("localizes application feedback with dynamic limits and retry counts", () => {
    expect(
      translateFeedback("en", "A mensagem deve ter no máximo 250 caracteres."),
    ).toBe("The message must be no longer than 250 characters.");
    expect(
      translateFeedback(
        "es",
        "Reconectando a transcrição… Tentativa 2/3. O trecho interrompido não será reenviado.",
      ),
    ).toContain("Intento 2/3");
    expect(
      translateFeedback(
        "zh-CN",
        "O idioma de voz DE não é reconhecido. Selecione um idioma disponível em “Idioma falado”.",
      ),
    ).toContain("DE");
  });
  it("uses localized feedback for unknown server messages", () => {
    expect(translateFeedback("en", "Unmapped internal response")).toBe(
      "Could not complete the operation. Try again.",
    );
    expect(translateFeedback("pt-BR", "Detalhe do servidor")).toBe(
      "Detalhe do servidor",
    );
  });
  it("localizes date labels without changing the local clock", () => {
    const date = new Date(2026, 9, 5, 13, 24);
    expect(formatLocalDateTime(date, "pt-BR").formattedDateTime).toBe(
      "13:24 • seg - 5 de out",
    );
    expect(formatLocalDateTime(date, "en").formattedDateTime).toBe(
      "13:24 • Mon - 5 Oct",
    );
    expect(formatLocalDateTime(date, "es").weekDay).toBe("lun");
    expect(formatLocalDateTime(date, "zh-CN").formattedDateTime).toContain(
      "10月5日",
    );
  });
});
