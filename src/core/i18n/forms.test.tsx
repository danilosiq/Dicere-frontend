import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateRoomForm, JoinRoomForm } from "@/core/forms";
import { SiteLanguageSelector } from "@/core/components/site-language-selector";
import { SiteLanguageProvider } from "./provider";
import { SITE_LOCALE_STORAGE_KEY, type SiteLocale } from "./locales";
import { translate } from "./translate";
import type { MessageKey } from "./types";

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "" }),
  Roboto: () => ({ className: "" }),
}));

const target = "Idioma que deseja receber as traduções";
const spoken = "Idioma que você irá falar na chamada";
function select(label: string, name: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: new RegExp(name + "$") }));
}

describe("localized room forms", () => {
  beforeEach(() => localStorage.clear());
  it.each(["en", "es", "zh-CN"] as const)(
    "submits original language codes in %s",
    async (locale) => {
      localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
      const t = (key: MessageKey) => translate(locale, key);
      const onSubmit = vi.fn();
      render(
        <SiteLanguageProvider>
          <CreateRoomForm onSubmit={onSubmit} />
        </SiteLanguageProvider>,
      );
      await screen.findByText(t("Título da sala"));
      expect(
        screen.getByLabelText(new RegExp(t("Título da sala"))).closest("form")
          ?.noValidate,
      ).toBe(true);
      fireEvent.change(screen.getByLabelText(new RegExp(t("Título da sala"))), {
        target: { value: "Título original" },
      });
      fireEvent.change(screen.getByLabelText(new RegExp(t("Seu nome"))), {
        target: { value: "João" },
      });
      fireEvent.change(
        screen.getByLabelText(new RegExp(t("Senha")), { selector: "input" }),
        { target: { value: "secret" } },
      );
      select(t(target), t("Português"));
      select(t(spoken), t("Espanhol"));
      fireEvent.click(screen.getByRole("button", { name: t("Confirmar") }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          title: "Título original",
          nickname: "João",
          password: "secret",
          targetLanguage: "PT-BR",
          spokenLanguage: "ES",
        }),
      );
    },
  );
  it("keeps form values and language choices when switching the interface", async () => {
    localStorage.setItem(SITE_LOCALE_STORAGE_KEY, "en");
    render(
      <SiteLanguageProvider>
        <SiteLanguageSelector />
        <JoinRoomForm
          initialRoomCode="ABC-234-K9X"
          initialName="João"
          initialSpokenLanguage="EN"
          initialTargetLanguage="ES"
        />
      </SiteLanguageProvider>,
    );
    await screen.findByRole("button", { name: "Site language" });
    fireEvent.change(screen.getByLabelText(/Password/), {
      target: { value: "secret" },
    });
    select("Site language", "Chinese");
    await screen.findByRole("button", { name: "网站语言" });
    expect((screen.getByLabelText(/你的名字/) as HTMLInputElement).value).toBe(
      "João",
    );
    expect((screen.getByLabelText(/房间代码/) as HTMLInputElement).value).toBe(
      "ABC-234-K9X",
    );
    expect(
      (screen.getByLabelText(/密码/, { selector: "input" }) as HTMLInputElement)
        .value,
    ).toBe("secret");
    expect(
      screen.getByRole("button", { name: translate("zh-CN", spoken) })
        .textContent,
    ).toContain("英语");
    expect(
      screen.getByRole("button", { name: translate("zh-CN", target) })
        .textContent,
    ).toContain("西班牙语");
  });
  it("updates already-visible validation messages with the interface language", async () => {
    localStorage.setItem(SITE_LOCALE_STORAGE_KEY, "en");
    const view = render(
      <SiteLanguageProvider>
        <SiteLanguageSelector />
        <CreateRoomForm />
      </SiteLanguageProvider>,
    );
    await screen.findByRole("button", { name: "Site language" });
    fireEvent.submit(view.container.querySelector("form")!);
    await screen.findByText("Enter the room title");
    select("Site language", "Spanish");
    await screen.findByText("Introduce el título de la sala");
    expect(screen.queryByText("Enter the room title")).toBeNull();
    expect(localStorage.getItem(SITE_LOCALE_STORAGE_KEY)).toBe("es");
  });
  it.each(["en", "es", "zh-CN"] as SiteLocale[])(
    "shows translated resume-only form in %s",
    async (locale) => {
      localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
      render(
        <SiteLanguageProvider>
          <JoinRoomForm
            initialRoomCode="ABC-234-K9X"
            initialName="João"
            initialSpokenLanguage="EN"
            initialTargetLanguage="ES"
            resumeOnly
          />
        </SiteLanguageProvider>,
      );
      await screen.findByRole("button", { name: translate(locale, target) });
      expect(
        screen.queryByLabelText(new RegExp(translate(locale, "Seu nome"))),
      ).toBeNull();
      expect(
        screen.getByRole("button", { name: translate(locale, spoken) })
          .textContent,
      ).toContain(translate(locale, "Inglês"));
    },
  );
});
