import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ReceivedVoiceTranslation } from "@/core/hooks/use-speech-translation";

import { SubtitleCamp } from "./subtitle-camp";
import {
  clearSpeechTranslationMetrics,
  getSpeechTranslationMetrics,
  recordSpeechTranslationMetric,
} from "@/core/services/speech-translation-service";

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
  it("registra a renderização da legenda no DOM uma vez por trecho e revisão", () => {
    clearSpeechTranslationMetrics();
    recordSpeechTranslationMetric({
      name: "receive",
      observedAt: performance.now() - 2,
      segmentId: "segment-1",
      traceId: "trace-1",
    });
    const translation = {
      ...makeTranslation(1, "Traduzione"),
      segmentId: "segment-1",
      traceId: "trace-1",
      revision: 0,
    };
    const { rerender } = render(
      <SubtitleCamp {...defaultProps} translations={[translation]} />,
    );
    expect(
      screen
        .getByLabelText("Legenda traduzida")
        .querySelector('[data-speech-segment-id="segment-1"]'),
    ).toBeTruthy();
    rerender(<SubtitleCamp {...defaultProps} translations={[translation]} />);
    expect(
      getSpeechTranslationMetrics().filter(
        (metric) => metric.name === "render",
      ),
    ).toEqual([
      expect.objectContaining({
        segmentId: "segment-1",
        traceId: "trace-1",
        durationMs: expect.any(Number),
      }),
    ]);
  });
  it("identifica a origem e a leitura sem mudar o destino ao selecionar a fala", () => {
    const onLanguageChange = vi.fn();
    render(
      <SubtitleCamp
        {...defaultProps}
        targetLanguage="IT"
        onLanguageChange={onLanguageChange}
      />,
    );
    expect(screen.getByText("Idioma falado")).toBeTruthy();
    expect(screen.getByText("Você lê: IT")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Selecionar idioma: Português" }),
    );
    fireEvent.click(screen.getByRole("option", { name: /Espanhol$/ }));
    expect(onLanguageChange).toHaveBeenCalledWith("ES");
    expect(screen.getByText("Você lê: IT")).toBeTruthy();
  });
  it("expõe somente a correlação técnica da legenda visível, sem duplicar o texto original", () => {
    const translation = {
      ...makeTranslation(1, "Traduzione"),
      segmentId: "segment-1",
    };
    render(<SubtitleCamp {...defaultProps} translations={[translation]} />);
    const subtitle =
      screen.getByLabelText("Legenda traduzida").firstElementChild;
    expect(subtitle?.getAttribute("data-speech-segment-id")).toBe("segment-1");
    expect(subtitle?.getAttribute("data-speech-participant-id")).toBe(
      "participant-2",
    );
    expect(subtitle?.outerHTML).not.toContain(translation.originalText);
  });

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
      screen.getByRole("button", { name: "Selecionar idioma: Português" }),
    ).toBeTruthy();
    const feed = screen.getByLabelText("Legenda traduzida");
    expect(within(feed).getByText("Primeira tradução")).toBeTruthy();
    expect(within(feed).getByText("Segunda tradução")).toBeTruthy();
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

  it("mantém visíveis somente as três traduções mais recentes", () => {
    render(
      <SubtitleCamp
        {...defaultProps}
        translations={[
          makeTranslation(1, "Primeira"),
          makeTranslation(2, "Segunda"),
          makeTranslation(3, "Terceira"),
          makeTranslation(4, "Quarta"),
          makeTranslation(5, "Quinta"),
        ]}
      />,
    );

    const feed = screen.getByLabelText("Legenda traduzida");
    expect(within(feed).queryByText("Primeira")).toBeNull();
    expect(within(feed).queryByText("Segunda")).toBeNull();
    expect(within(feed).getByText("Terceira")).toBeTruthy();
    expect(within(feed).getByText("Quarta")).toBeTruthy();
    expect(within(feed).getByText("Quinta")).toBeTruthy();
    expect(feed.childElementCount).toBe(3);
  });

  it("promove uma legenda atrasada à janela sem perder a ordem de leitura", () => {
    const translations = [
      { ...makeTranslation(1, "Atrasada"), receivedOrder: 4 },
      { ...makeTranslation(2, "Segunda"), receivedOrder: 1 },
      { ...makeTranslation(3, "Terceira"), receivedOrder: 2 },
      { ...makeTranslation(4, "Quarta"), receivedOrder: 3 },
    ];
    render(<SubtitleCamp {...defaultProps} translations={translations} />);
    const feed = screen.getByLabelText("Legenda traduzida");
    expect(Array.from(feed.children).map((item) => item.textContent)).toEqual([
      "Atrasada ",
      "Terceira ",
      "Quarta ",
    ]);
    expect(screen.getByRole("status").textContent).toBe("Atrasada");
  });

  it("rola até a legenda atrasada, sem apenas posicionar o feed no fim", () => {
    const translations = [
      { ...makeTranslation(1, "Atrasada"), receivedOrder: 4 },
      { ...makeTranslation(3, "Terceira"), receivedOrder: 2 },
      { ...makeTranslation(4, "Quarta"), receivedOrder: 3 },
    ];
    const { rerender } = render(
      <SubtitleCamp
        {...defaultProps}
        translations={translations.map((translation) => ({
          ...translation,
          receivedOrder: translation.sequence,
        }))}
      />,
    );
    const feed = screen.getByLabelText("Legenda traduzida");
    Object.defineProperty(feed, "scrollHeight", {
      configurable: true,
      value: 500,
    });
    Object.defineProperty(feed, "clientHeight", {
      configurable: true,
      value: 100,
    });
    feed.getBoundingClientRect = () => ({ top: 100, bottom: 200 }) as DOMRect;
    const first = feed.firstElementChild as HTMLElement;
    first.getBoundingClientRect = () => ({ top: 120, bottom: 145 }) as DOMRect;
    rerender(<SubtitleCamp {...defaultProps} translations={translations} />);
    expect(feed.scrollTop).toBe(20);
  });

  it("promove uma revisão aceita uma vez e não duplica a métrica no rerender", () => {
    clearSpeechTranslationMetrics();
    const previous = {
      ...makeTranslation(1, "Provisória"),
      segmentId: "segment-review",
      traceId: "trace-review",
      revision: 0,
      status: "provisional" as const,
      receivedOrder: 1,
    };
    const final = {
      ...previous,
      translatedText: "Final",
      revision: 1,
      status: "final" as const,
      receivedOrder: 4,
    };
    const rest = [
      { ...makeTranslation(2, "Segunda"), receivedOrder: 2 },
      { ...makeTranslation(3, "Terceira"), receivedOrder: 3 },
    ];
    const { rerender } = render(
      <SubtitleCamp {...defaultProps} translations={[previous, ...rest]} />,
    );
    rerender(
      <SubtitleCamp {...defaultProps} translations={[final, ...rest]} />,
    );
    rerender(
      <SubtitleCamp {...defaultProps} translations={[final, ...rest]} />,
    );
    expect(screen.getByRole("status").textContent).toBe("Final");
    expect(
      getSpeechTranslationMetrics().filter(
        (metric) =>
          metric.name === "render" && metric.segmentId === "segment-review",
      ),
    ).toHaveLength(2);
  });

  it("separa as traduções em blocos e mantém separador textual", () => {
    render(
      <SubtitleCamp
        {...defaultProps}
        translations={[
          makeTranslation(1, "Danilo"),
          makeTranslation(2, "Nice"),
        ]}
      />,
    );

    const feed = screen.getByLabelText("Legenda traduzida");
    expect(
      Array.from(feed.children).every((item) => item.tagName === "P"),
    ).toBe(true);
    expect(feed.textContent).toBe("Danilo Nice ");
  });

  it("anuncia somente a tradução mais recente fora do histórico", () => {
    render(
      <SubtitleCamp
        {...defaultProps}
        translations={[
          makeTranslation(1, "Anterior"),
          makeTranslation(2, "Mais recente"),
        ]}
      />,
    );

    const feed = screen.getByLabelText("Legenda traduzida");
    const liveRegion = screen.getByRole("status", {
      name: "Nova legenda traduzida",
    });
    expect(feed.getAttribute("aria-live")).toBeNull();
    expect(liveRegion.getAttribute("aria-live")).toBe("polite");
    expect(liveRegion.textContent).toBe("Mais recente");
  });
});
