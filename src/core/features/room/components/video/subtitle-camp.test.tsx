import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReceivedVoiceTranslation } from "@/core/hooks/use-speech-translation";

import { SubtitleCamp } from "./subtitle-camp";

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "", variable: "" }),
  Roboto: () => ({ className: "", variable: "" }),
}));

function makeTranslation(
  sequence: number,
  translatedText: string,
): ReceivedVoiceTranslation {
  return {
    sequence,
    roomId: "room-1",
    fromParticipantId: "participant-2",
    fromParticipantName: "Maria",
    originalText: "Original text",
    translatedText,
    targetLanguage: "PT-BR",
  };
}

const defaultProps = {
  captionIssue: null,
  language: "PT-BR" as const,
  translations: [] as ReceivedVoiceTranslation[],
  onLanguageChange: vi.fn(),
  retryRecognition: vi.fn(),
};

describe("SubtitleCamp", () => {
  it("renderiza somente o seletor e o histórico de traduções", () => {
    render(
      <SubtitleCamp
        {...defaultProps}
        translations={[
          makeTranslation(1, "Primeira tradução"),
          makeTranslation(2, "Segunda tradução"),
        ]}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Selecionar idioma" }),
    ).toBeTruthy();
    expect(screen.getByText("Primeira tradução")).toBeTruthy();
    expect(screen.getByText("Segunda tradução")).toBeTruthy();
    expect(screen.queryByText(/você:/i)).toBeNull();
    expect(screen.queryByText(/sua fala reconhecida/i)).toBeNull();
    expect(screen.queryByText(/reconhecimento/i)).toBeNull();
  });

  it("não renderiza placeholder quando ainda não recebeu traduções", () => {
    render(<SubtitleCamp {...defaultProps} />);

    const feed = screen.getByLabelText("Legenda traduzida");
    expect(feed.childElementCount).toBe(0);
    expect(feed.classList.contains("scroll-smooth")).toBe(false);
  });

  it("mostra recuperação de rede em âmbar e permite uma tentativa manual", () => {
    const retryRecognition = vi.fn();

    render(
      <SubtitleCamp
        {...defaultProps}
        captionIssue={{
          status: "retry_wait",
          message: "Reconhecimento temporariamente indisponível",
          retryable: true,
        }}
        retryRecognition={retryRecognition}
      />,
    );

    const retryButton = screen.getByRole("button", {
      name: "Reconhecimento temporariamente indisponível",
    });
    expect(retryButton.classList.contains("text-amber-600")).toBe(true);

    fireEvent.click(retryButton);
    expect(retryRecognition).toHaveBeenCalledOnce();
  });

  it("mostra bloqueio em vermelho e não executa retry quando não é recuperável", () => {
    const retryRecognition = vi.fn();

    render(
      <SubtitleCamp
        {...defaultProps}
        captionIssue={{
          status: "blocked",
          message: "Permissão de microfone bloqueada",
          retryable: false,
        }}
        retryRecognition={retryRecognition}
      />,
    );

    const issueButton = screen.getByRole("button", {
      name: "Permissão de microfone bloqueada",
    });
    expect(issueButton.classList.contains("text-error")).toBe(true);
    expect((issueButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(issueButton);
    expect(retryRecognition).not.toHaveBeenCalled();
  });

  it("permite retry manual em um bloqueio recuperável", () => {
    const retryRecognition = vi.fn();

    render(
      <SubtitleCamp
        {...defaultProps}
        captionIssue={{
          status: "blocked",
          message: "Permissão de microfone bloqueada",
          retryable: true,
        }}
        retryRecognition={retryRecognition}
      />,
    );

    const retryButton = screen.getByRole("button", {
      name: "Permissão de microfone bloqueada",
    });
    expect(retryButton.classList.contains("text-error")).toBe(true);

    fireEvent.click(retryButton);
    expect(retryRecognition).toHaveBeenCalledOnce();
  });

  it("posiciona o feed imediatamente na tradução mais recente", () => {
    const { rerender } = render(<SubtitleCamp {...defaultProps} />);
    const feed = screen.getByLabelText("Legenda traduzida");
    Object.defineProperty(feed, "scrollHeight", {
      configurable: true,
      value: 240,
    });

    rerender(
      <SubtitleCamp
        {...defaultProps}
        translations={[makeTranslation(1, "Nova tradução")]}
      />,
    );

    expect(feed.scrollTop).toBe(240);
  });
});
