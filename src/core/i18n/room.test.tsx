import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CallTools } from "@/core/features/room/components/video/call-tools";
import { SpeechPrivacyNotice } from "@/core/features/room/components/video/speech-privacy-notice";
import { SubtitleCamp } from "@/core/features/room/components/video/subtitle-camp";
import { ChatBalloon } from "@/core/features/room/components/chat/chat-balloon";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { SiteLanguageProvider } from "./provider";
import { SITE_LOCALE_STORAGE_KEY } from "./locales";
import { translate } from "./translate";

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "" }),
  Roboto: () => ({ className: "" }),
}));
vi.mock("@/core/components/logo", () => ({ Logo: () => <span>Dicere</span> }));

describe("localized call and chat controls", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("dicere-theme", "light");
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it.each(["en", "es", "zh-CN"] as const)(
    "localizes call controls and consent in %s",
    async (locale) => {
      localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale);
      const sessionBefore = useRoomSessionStore.getState();
      render(
        <SiteLanguageProvider>
          <CallTools copyInviteStatus="success" />
          <SpeechPrivacyNotice onAccept={vi.fn()} />
        </SiteLanguageProvider>,
      );
      await screen.findByRole("button", {
        name: translate(locale, "Sair da chamada"),
      });
      expect(
        screen.getByRole("button", { name: translate(locale, "Compartilhar") }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: translate(locale, "Ativar transcrição nesta sala"),
        }),
      ).toBeTruthy();
      expect(screen.getByRole("status").textContent).toBe(
        translate(locale, "Copiado!"),
      );
      expect(useRoomSessionStore.getState()).toBe(sessionBefore);
    },
  );
  it("does not translate the user's name, chat content or received subtitle", async () => {
    localStorage.setItem(SITE_LOCALE_STORAGE_KEY, "en");
    render(
      <SiteLanguageProvider>
        <ChatBalloon
          role="sender"
          message={{
            id: "message-1",
            roomId: "room-1",
            participantId: "participant-1",
            participantName: "Cancelar",
            content: "Criar uma sala",
            sourceLanguage: "PT-BR",
            createdAt: "2026-10-04T12:00:00Z",
          }}
        />
        <SubtitleCamp
          language="PT-BR"
          targetLanguage="ES"
          onLanguageChange={vi.fn()}
          retryRecognition={vi.fn()}
          captionIssue={{
            status: "blocked",
            retryable: false,
            message: "A mensagem deve ter no máximo 250 caracteres.",
          }}
          translations={[
            {
              roomId: "room-1",
              fromParticipantId: "participant-2",
              fromParticipantName: "João",
              originalText: "Original",
              translatedText: "Ver original",
              targetLanguage: "ES",
              sequence: 1,
            },
          ]}
        />
      </SiteLanguageProvider>,
    );
    await screen.findByLabelText("Translated captions");
    expect(screen.getByText("Cancelar")).toBeTruthy();
    expect(screen.getByText("Criar uma sala")).toBeTruthy();
    expect(screen.getByLabelText("Translated captions").textContent).toContain(
      "Ver original",
    );
    expect(
      screen.getByRole("img", {
        name: "The message must be no longer than 250 characters.",
      }),
    ).toBeTruthy();
  });
});
