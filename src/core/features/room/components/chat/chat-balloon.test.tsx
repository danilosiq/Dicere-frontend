import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatBalloon } from "@/core/features/room/components/chat/chat-balloon";

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "", variable: "" }),
  Roboto: () => ({ className: "", variable: "" }),
}));

const message = {
  id: "message-id",
  roomId: "room-id",
  participantId: "participant-id",
  participantName: "Danilo",
  content: "Uma mensagem real",
  sourceLanguage: "PT-BR" as const,
  createdAt: "2026-07-29T12:34:00",
};

describe("ChatBalloon", () => {
  it("renders the server message data and formatted time", () => {
    render(<ChatBalloon message={message} role="sender" />);

    expect(screen.getByText("Danilo")).toBeTruthy();
    expect(screen.getByText("Uma mensagem real")).toBeTruthy();
    expect(screen.getByText("12:34")).toBeTruthy();
  });

  it("uses a safe fallback for an invalid date", () => {
    render(
      <ChatBalloon
        message={{ ...message, createdAt: "invalid-date" }}
        role="receiver"
      />,
    );

    expect(screen.getByText("--:--")).toBeTruthy();
  });

  it("translates and toggles between translated and original content", () => {
    const onTranslate = vi.fn();
    const onShowOriginal = vi.fn();
    const { rerender } = render(
      <ChatBalloon
        message={message}
        onShowOriginal={onShowOriginal}
        onTranslate={onTranslate}
        role="receiver"
        translation={{
          displayedContent: message.content,
          displayMode: "original",
          hasTranslation: false,
          isLoading: false,
          error: null,
          disabledReason: null,
        }}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Traduzir mensagem de Danilo",
      }),
    );
    expect(onTranslate).toHaveBeenCalledOnce();

    rerender(
      <ChatBalloon
        displayedContent="Uma mensagem traduzida"
        message={message}
        onShowOriginal={onShowOriginal}
        onTranslate={onTranslate}
        role="receiver"
        translation={{
          displayedContent: "Uma mensagem traduzida",
          displayMode: "translated",
          translatedContent: "Uma mensagem traduzida",
          hasTranslation: true,
          isLoading: false,
          error: null,
          disabledReason: null,
        }}
      />,
    );

    expect(screen.getByText("Uma mensagem traduzida")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver original mensagem de Danilo",
      }),
    );
    expect(onShowOriginal).toHaveBeenCalledOnce();
  });

  it("shows independent loading, disabled and retry states", () => {
    const onRetryTranslation = vi.fn();
    const { rerender } = render(
      <ChatBalloon
        message={message}
        role="sender"
        translation={{
          displayedContent: message.content,
          displayMode: "original",
          hasTranslation: false,
          isLoading: true,
          error: null,
          disabledReason: null,
        }}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Traduzindo... mensagem de Danilo",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    rerender(
      <ChatBalloon
        message={message}
        onRetryTranslation={onRetryTranslation}
        role="sender"
        translation={{
          displayedContent: message.content,
          displayMode: "original",
          hasTranslation: false,
          isLoading: false,
          error: "Falha ao traduzir",
          disabledReason: null,
        }}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "Falha ao traduzir",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Tentar novamente mensagem de Danilo",
      }),
    );
    expect(onRetryTranslation).toHaveBeenCalledOnce();

    rerender(
      <ChatBalloon
        message={message}
        role="sender"
        translation={{
          displayedContent: message.content,
          displayMode: "original",
          hasTranslation: false,
          isLoading: false,
          error: null,
          disabledReason: "Selecione um idioma de destino válido.",
        }}
      />,
    );

    expect(
      screen.getByText("Selecione um idioma de destino válido."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", {
          name: "Traduzir mensagem de Danilo",
        })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });
});
