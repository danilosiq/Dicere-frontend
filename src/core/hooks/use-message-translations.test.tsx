import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import axios from "axios";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  translateChatMessage: vi.fn(),
}));

vi.mock("@/core/services/chat-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/services/chat-service")
  >("@/core/services/chat-service");

  return {
    ...actual,
    translateChatMessage: mocks.translateChatMessage,
  };
});

import type { ChatMessage } from "@/core/@types/chat";
import { useMessageTranslations } from "@/core/hooks/use-message-translations";

const message: ChatMessage = {
  id: "message-id",
  roomId: "room-id",
  participantId: "participant-id",
  participantName: "Maria",
  content: "Hello",
  sourceLanguage: "EN",
  createdAt: "2026-07-29T12:34:00.000Z",
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function translationResponse(overrides = {}) {
  return {
    messageId: message.id,
    originalContent: message.content,
    translatedContent: "Olá",
    targetLanguage: "PT-BR",
    ...overrides,
  };
}

describe("useMessageTranslations", () => {
  beforeEach(() => {
    mocks.translateChatMessage.mockReset();
  });

  it.each([undefined, "INVALID"])(
    "disables translation without a valid target language (%s)",
    async (targetLanguage) => {
      const { result } = renderHook(
        () =>
          useMessageTranslations({
            roomId: "room-id",
            targetLanguage,
          }),
        { wrapper: createWrapper() },
      );

      expect(result.current.getTranslationState(message)).toMatchObject({
        displayedContent: "Hello",
        displayMode: "original",
        disabledReason: "Selecione um idioma de destino válido para traduzir.",
      });

      await act(async () => {
        await expect(result.current.translate(message)).resolves.toBe(false);
      });
      expect(mocks.translateChatMessage).not.toHaveBeenCalled();
    },
  );

  it("translates, shows the original and reuses cache without another request", async () => {
    mocks.translateChatMessage.mockResolvedValue(translationResponse());
    const { result } = renderHook(
      () =>
        useMessageTranslations({
          roomId: "room-id",
          targetLanguage: "PT-BR",
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await expect(result.current.translate(message)).resolves.toBe(true);
    });

    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Olá",
      displayMode: "translated",
      hasTranslation: true,
      isLoading: false,
      error: null,
    });

    act(() => result.current.showOriginal(message.id));
    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Hello",
      displayMode: "original",
      hasTranslation: true,
    });

    act(() => result.current.showTranslation(message.id));
    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Olá",
      displayMode: "translated",
    });
    expect(mocks.translateChatMessage).toHaveBeenCalledOnce();
  });

  it("blocks duplicate requests while keeping messages independent", async () => {
    let resolveFirst:
      ((value: ReturnType<typeof translationResponse>) => void) | undefined;
    mocks.translateChatMessage
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(
        translationResponse({
          messageId: "second-message",
          originalContent: "Good morning",
          translatedContent: "Bom dia",
        }),
      );
    const secondMessage: ChatMessage = {
      ...message,
      id: "second-message",
      content: "Good morning",
    };
    const { result } = renderHook(
      () =>
        useMessageTranslations({
          roomId: "room-id",
          targetLanguage: "PT-BR",
        }),
      { wrapper: createWrapper() },
    );

    let firstRequest: Promise<boolean>;
    let duplicateRequest: Promise<boolean>;
    let secondRequest: Promise<boolean>;
    await act(async () => {
      firstRequest = result.current.translate(message);
      duplicateRequest = result.current.translate(message);
      secondRequest = result.current.translate(secondMessage);
      await Promise.resolve();
    });

    expect(mocks.translateChatMessage).toHaveBeenCalledTimes(2);
    expect(result.current.getTranslationState(message).isLoading).toBe(true);

    await act(async () => {
      resolveFirst?.(translationResponse());
      await Promise.all([firstRequest, duplicateRequest, secondRequest]);
    });

    expect(result.current.getTranslationState(message).displayedContent).toBe(
      "Olá",
    );
    expect(
      result.current.getTranslationState(secondMessage).displayedContent,
    ).toBe("Bom dia");
  });

  it("rejects incompatible responses, preserves the original and retries", async () => {
    mocks.translateChatMessage
      .mockResolvedValueOnce(
        translationResponse({ messageId: "another-message" }),
      )
      .mockResolvedValueOnce(translationResponse());
    const { result } = renderHook(
      () =>
        useMessageTranslations({
          roomId: "room-id",
          targetLanguage: "PT-BR",
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await expect(result.current.translate(message)).resolves.toBe(false);
    });

    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Hello",
      displayMode: "original",
      error: "O servidor retornou uma tradução incompatível com a mensagem.",
    });

    await act(async () => {
      await expect(result.current.retryTranslation(message)).resolves.toBe(
        true,
      );
    });

    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Olá",
      displayMode: "translated",
      error: null,
    });
  });

  it.each([
    { targetLanguage: "FR" },
    { originalContent: "Different original" },
    { translatedContent: "   " },
  ])("rejects an incompatible response", async (overrides) => {
    mocks.translateChatMessage.mockResolvedValue(
      translationResponse(overrides),
    );
    const { result } = renderHook(
      () =>
        useMessageTranslations({
          roomId: "room-id",
          targetLanguage: "PT-BR",
        }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await expect(result.current.translate(message)).resolves.toBe(false);
    });

    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Hello",
      displayMode: "original",
      hasTranslation: false,
      error: "O servidor retornou uma tradução incompatível com a mensagem.",
    });
  });

  it("clears the visible cache and ignores a late response after changing rooms", async () => {
    let resolveTranslation:
      ((value: ReturnType<typeof translationResponse>) => void) | undefined;
    mocks.translateChatMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveTranslation = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ roomId }) =>
        useMessageTranslations({
          roomId,
          targetLanguage: "PT-BR",
        }),
      {
        initialProps: { roomId: "room-id" },
        wrapper: createWrapper(),
      },
    );

    act(() => {
      void result.current.translate(message);
    });
    rerender({ roomId: "room-2" });

    await act(async () => {
      resolveTranslation?.(translationResponse());
      await Promise.resolve();
    });

    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Hello",
      displayMode: "original",
      hasTranslation: false,
      isLoading: false,
    });
  });

  it("does not resurrect a previous room cache when returning to it", async () => {
    mocks.translateChatMessage.mockResolvedValue(translationResponse());
    const { result, rerender } = renderHook(
      ({ roomId }) =>
        useMessageTranslations({
          roomId,
          targetLanguage: "PT-BR",
        }),
      {
        initialProps: { roomId: "room-id" },
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.translate(message);
    });
    expect(result.current.getTranslationState(message).hasTranslation).toBe(
      true,
    );

    rerender({ roomId: "room-2" });
    rerender({ roomId: "room-id" });

    expect(result.current.getTranslationState(message)).toMatchObject({
      displayedContent: "Hello",
      displayMode: "original",
      hasTranslation: false,
    });
  });

  it("keeps cache entries per language while the room remains active", async () => {
    mocks.translateChatMessage
      .mockResolvedValueOnce(translationResponse())
      .mockResolvedValueOnce(
        translationResponse({
          translatedContent: "Bonjour",
          targetLanguage: "FR",
        }),
      );
    const { result, rerender } = renderHook(
      ({ targetLanguage }) =>
        useMessageTranslations({
          roomId: "room-id",
          targetLanguage,
        }),
      {
        initialProps: { targetLanguage: "PT-BR" },
        wrapper: createWrapper(),
      },
    );

    await act(async () => {
      await result.current.translate(message);
    });
    rerender({ targetLanguage: "FR" });
    await act(async () => {
      await result.current.translate(message);
    });
    rerender({ targetLanguage: "PT-BR" });
    await act(async () => {
      await result.current.translate(message);
    });

    expect(result.current.getTranslationState(message).displayedContent).toBe(
      "Olá",
    );
    expect(mocks.translateChatMessage).toHaveBeenCalledTimes(2);
  });

  it("does not let an aborted request remove a newer in-flight lock", async () => {
    const resolvers: Array<
      (value: ReturnType<typeof translationResponse>) => void
    > = [];
    mocks.translateChatMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        }),
    );
    const { result, rerender } = renderHook(
      ({ roomId }) =>
        useMessageTranslations({
          roomId,
          targetLanguage: "PT-BR",
        }),
      {
        initialProps: { roomId: "room-id" },
        wrapper: createWrapper(),
      },
    );

    let firstRequest: Promise<boolean>;
    act(() => {
      firstRequest = result.current.translate(message);
    });
    await waitFor(() => {
      expect(mocks.translateChatMessage).toHaveBeenCalledOnce();
    });
    rerender({ roomId: "room-2" });
    rerender({ roomId: "room-id" });

    let secondRequest: Promise<boolean>;
    act(() => {
      secondRequest = result.current.translate(message);
    });
    await waitFor(() => {
      expect(mocks.translateChatMessage).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      resolvers[0]?.(translationResponse());
      await firstRequest;
    });

    let duplicateRequest: Promise<boolean>;
    act(() => {
      duplicateRequest = result.current.translate(message);
    });
    expect(mocks.translateChatMessage).toHaveBeenCalledTimes(2);

    await act(async () => {
      resolvers[1]?.(translationResponse());
      await Promise.all([secondRequest, duplicateRequest]);
    });

    expect(result.current.getTranslationState(message).displayedContent).toBe(
      "Olá",
    );
  });

  it.each([
    [
      400,
      "Não foi possível traduzir esta mensagem. Verifique os dados e tente novamente.",
    ],
    [404, "A mensagem não está mais disponível para tradução."],
    [
      500,
      "O serviço de tradução está indisponível. Tente novamente em instantes.",
    ],
  ])(
    "maps HTTP %i to a localized retryable error",
    async (status, expectedMessage) => {
      const cause = Object.assign(new Error("Raw backend error"), {
        isAxiosError: true,
        response: {
          data: { message: "Internal server error" },
          status,
        },
      });
      expect(axios.isAxiosError(cause)).toBe(true);
      mocks.translateChatMessage.mockRejectedValue(cause);
      const { result } = renderHook(
        () =>
          useMessageTranslations({
            roomId: "room-id",
            targetLanguage: "PT-BR",
          }),
        { wrapper: createWrapper() },
      );

      await act(async () => {
        await result.current.translate(message);
      });

      expect(result.current.getTranslationState(message)).toMatchObject({
        displayedContent: "Hello",
        displayMode: "original",
        error: expectedMessage,
      });
    },
  );
});
