import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ChatSection } from "@/core/features/room/components/chat/chat-section";
import { useRoomSessionStore } from "@/core/store/room-session-store";

const mocks = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  listChatMessages: vi.fn(),
  translateChatMessage: vi.fn(),
  receivedMessageListener: undefined as
    ((message: import("@/core/@types/chat").ChatMessage) => void) | undefined,
  connectionListener: undefined as ((isConnected: boolean) => void) | undefined,
}));

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "", variable: "" }),
  Roboto: () => ({ className: "", variable: "" }),
}));

vi.mock("@/core/services/chat-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/services/chat-service")
  >("@/core/services/chat-service");

  return {
    ...actual,
    isChatConnected: () => true,
    listChatMessages: mocks.listChatMessages,
    sendChatMessage: mocks.sendChatMessage,
    translateChatMessage: mocks.translateChatMessage,
    subscribeToReceivedChatMessages: ({
      onMessage,
    }: {
      onMessage: (message: import("@/core/@types/chat").ChatMessage) => void;
    }) => {
      mocks.receivedMessageListener = onMessage;
      return () => {
        mocks.receivedMessageListener = undefined;
      };
    },
    subscribeToChatConnection: (listener: (isConnected: boolean) => void) => {
      mocks.connectionListener = listener;
      listener(true);
      return () => {
        mocks.connectionListener = undefined;
      };
    },
  };
});

const message = {
  id: "message-id",
  roomId: "room-id",
  participantId: "participant-id",
  participantName: "Danilo",
  content: "Olá",
  sourceLanguage: "PT-BR" as const,
  createdAt: "2026-07-29T12:34:00.000Z",
};

function selectSourceLanguage(language = "PT-BR") {
  fireEvent.click(
    screen.getByRole("button", {
      name: /Selecionar idioma(?:$|:)/,
    }),
  );
  fireEvent.click(screen.getByRole("option", { name: new RegExp(language) }));
}

function renderChatSection({
  selectLanguage = true,
}: { selectLanguage?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const view = render(
    <QueryClientProvider client={queryClient}>
      <ChatSection />
    </QueryClientProvider>,
  );

  if (selectLanguage) {
    selectSourceLanguage();
  }

  return view;
}

describe("ChatSection sending", () => {
  beforeEach(() => {
    mocks.sendChatMessage.mockReset();
    mocks.listChatMessages.mockReset();
    mocks.translateChatMessage.mockReset();
    mocks.listChatMessages.mockResolvedValue({
      messages: [],
      nextCursor: null,
    });
    mocks.receivedMessageListener = undefined;
    mocks.connectionListener = undefined;
    useRoomSessionStore.setState({
      room: {
        id: "room-id",
        code: "ABC-234-K9X",
        title: "Daily",
        status: "ACTIVE",
        participants: [],
      },
      participant: {
        id: "participant-id",
        roomId: "room-id",
        name: "Danilo",
        role: "ADM",
        targetLanguage: "PT-BR",
        createdAt: "2026-07-29T12:00:00.000Z",
      },
      resumeSession: null,
      isJoined: true,
      isHydrated: true,
    });
  });

  it("keeps the composer blocked until the source language is selected", async () => {
    mocks.sendChatMessage.mockResolvedValue(message);
    renderChatSection({ selectLanguage: false });

    await screen.findByText("Envie a primeira mensagem da sala.");
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    const sendButton = screen.getByRole("button", {
      name: "Enviar mensagem",
    }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "Olá" } });

    expect(sendButton.disabled).toBe(true);
    expect(
      screen.getByText("Selecione o idioma em que você está escrevendo."),
    ).toBeTruthy();
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();

    selectSourceLanguage();

    expect(sendButton.disabled).toBe(false);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mocks.sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ sourceLanguage: "PT-BR" }),
      );
    });
  });

  it("shows the real room title and sends by click", async () => {
    mocks.sendChatMessage.mockResolvedValue(message);
    renderChatSection();

    expect(screen.getByText("Daily")).toBeTruthy();
    await screen.findByText("Envie a primeira mensagem da sala.");

    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "  Olá  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    await waitFor(() => {
      expect(mocks.sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: "room-id",
          content: "Olá",
          sourceLanguage: "PT-BR",
        }),
      );
    });

    expect(await screen.findByText("Olá")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");
  });

  it("submits with Enter and blocks messages over the limit", async () => {
    mocks.sendChatMessage.mockResolvedValue(message);
    renderChatSection();

    await screen.findByText("Envie a primeira mensagem da sala.");
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "Olá" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(mocks.sendChatMessage).toHaveBeenCalledOnce();
    });

    fireEvent.change(input, { target: { value: "a".repeat(251) } });

    expect(screen.getByText("251/250")).toBeTruthy();
    expect(
      screen.getByText("A mensagem deve ter no máximo 250 caracteres."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Enviar mensagem",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("accepts a message with exactly 250 characters", async () => {
    const content = "a".repeat(250);
    mocks.sendChatMessage.mockResolvedValue({ ...message, content });
    renderChatSection();

    await screen.findByText("Envie a primeira mensagem da sala.");
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: content } });

    expect(screen.getByText("250/250")).toBeTruthy();
    const sendButton = screen.getByRole("button", {
      name: "Enviar mensagem",
    }) as HTMLButtonElement;
    expect(sendButton.disabled).toBe(false);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mocks.sendChatMessage).toHaveBeenCalledWith(
        expect.objectContaining({ content }),
      );
    });
  });

  it("keeps the draft and reports disconnection", async () => {
    renderChatSection();

    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "Mensagem pendente" } });

    act(() => {
      mocks.connectionListener?.(false);
    });

    expect((input as HTMLInputElement).value).toBe("Mensagem pendente");
    expect(
      screen.getByText("Chat desconectado. Aguarde a reconexão para enviar."),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Enviar mensagem",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();
  });

  it("announces a pending send and keeps the edited draft after confirmation", async () => {
    let resolveSend: ((value: typeof message) => void) | undefined;
    mocks.sendChatMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    renderChatSection();

    await screen.findByText("Envie a primeira mensagem da sala.");
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "Primeira mensagem" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(
      await screen.findByRole("button", { name: "Enviando mensagem" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain(
      "Enviando mensagem",
    );
    fireEvent.change(input, { target: { value: "Próxima mensagem" } });

    await act(async () => {
      resolveSend?.({ ...message, content: "Primeira mensagem" });
      await Promise.resolve();
    });

    expect((input as HTMLInputElement).value).toBe("Próxima mensagem");
    expect(screen.getByText("Primeira mensagem")).toBeTruthy();
  });

  it("keeps the draft after a send error and retries from the same composer", async () => {
    mocks.sendChatMessage
      .mockRejectedValueOnce(new Error("Não foi possível enviar agora"))
      .mockResolvedValueOnce({ ...message, content: "Tentar novamente" });
    renderChatSection();

    await screen.findByText("Envie a primeira mensagem da sala.");
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "Tentar novamente" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(
      await screen.findByText("Não foi possível enviar agora"),
    ).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Tentar novamente");

    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));

    expect(await screen.findByText("Tentar novamente")).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("");
    expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2);
  });

  it("renders loading, empty and recoverable initial-history states", async () => {
    let rejectHistory: ((reason: Error) => void) | undefined;
    mocks.listChatMessages.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectHistory = reject;
        }),
    );
    renderChatSection();

    expect(await screen.findByText("Carregando histórico...")).toBeTruthy();

    await act(async () => {
      rejectHistory?.(new Error("Não foi possível carregar o histórico"));
      await Promise.resolve();
    });

    expect(
      screen.getByText("Não foi possível carregar o histórico"),
    ).toBeTruthy();

    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [],
      nextCursor: null,
    });
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(
      await screen.findByText("Envie a primeira mensagem da sala."),
    ).toBeTruthy();
    expect(mocks.listChatMessages).toHaveBeenCalledTimes(2);
  });

  it("shows a remote message without reloading the page", async () => {
    renderChatSection();

    await screen.findByText("Envie a primeira mensagem da sala.");

    act(() => {
      mocks.receivedMessageListener?.({
        ...message,
        id: "remote-message",
        participantId: "participant-2",
        participantName: "Maria",
        content: "Mensagem recebida",
      });
    });

    expect(screen.getByText("Maria")).toBeTruthy();
    expect(screen.getByText("Mensagem recebida")).toBeTruthy();
  });

  it("loads older messages and preserves the visible scroll offset", async () => {
    let resolveOlder:
      | ((value: {
          messages: Array<typeof message>;
          nextCursor: string | null;
        }) => void)
      | undefined;
    const currentMessage = {
      ...message,
      id: "current-message",
      createdAt: "2026-07-29T12:34:00.000Z",
    };
    const olderMessage = {
      ...message,
      id: "older-message",
      content: "Mensagem antiga",
      createdAt: "2026-07-29T12:30:00.000Z",
    };
    mocks.listChatMessages
      .mockResolvedValueOnce({
        messages: [currentMessage],
        nextCursor: "2026-07-29T12:34:00.000Z",
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOlder = resolve;
          }),
      );
    renderChatSection();

    await screen.findByText("Olá");
    const viewport = screen.getByRole("log", {
      name: "Mensagens da sala",
    });
    let scrollHeight = 400;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: {
        configurable: true,
        get: () => scrollHeight,
      },
    });
    viewport.scrollTop = 40;

    fireEvent.click(
      screen.getByRole("button", { name: "Carregar anteriores" }),
    );
    expect(await screen.findByText("Carregando anteriores...")).toBeTruthy();

    scrollHeight = 450;
    act(() => {
      mocks.receivedMessageListener?.({
        ...message,
        id: "live-during-pagination",
        participantId: "participant-2",
        participantName: "Maria",
        content: "Mensagem ao vivo durante paginação",
        createdAt: "2026-07-29T12:35:00.000Z",
      });
    });

    scrollHeight = 650;
    await act(async () => {
      resolveOlder?.({ messages: [olderMessage], nextCursor: null });
      await Promise.resolve();
    });

    expect(screen.getByText("Mensagem antiga")).toBeTruthy();
    expect(screen.getByText("Mensagem ao vivo durante paginação")).toBeTruthy();
    expect(viewport.scrollTop).toBe(240);
  });

  it("does not force scroll while reading older messages and offers a shortcut to the end", async () => {
    const firstMessage = {
      ...message,
      id: "first-message",
      participantId: "participant-2",
      participantName: "Maria",
    };
    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [firstMessage],
      nextCursor: null,
    });
    renderChatSection();

    await screen.findByText("Olá");
    const viewport = screen.getByRole("log", {
      name: "Mensagens da sala",
    });
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 600 },
    });
    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);

    act(() => {
      mocks.receivedMessageListener?.({
        ...firstMessage,
        id: "second-message",
        content: "Mensagem mais nova",
        createdAt: "2026-07-29T12:35:00.000Z",
      });
    });

    expect(viewport.scrollTop).toBe(100);
    const latestButton = screen.getByRole("button", {
      name: "Novas mensagens",
    });

    fireEvent.click(latestButton);

    expect(viewport.scrollTop).toBe(600);
    expect(
      screen.queryByRole("button", { name: "Novas mensagens" }),
    ).toBeNull();
  });

  it("signals an out-of-order live message while the user reads older content", async () => {
    const latestMessage = {
      ...message,
      id: "latest-message",
      participantId: "participant-2",
      participantName: "Maria",
      createdAt: "2026-07-29T12:35:00.000Z",
    };
    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [latestMessage],
      nextCursor: null,
    });
    renderChatSection();

    await screen.findByText("Olá");
    const viewport = screen.getByRole("log", {
      name: "Mensagens da sala",
    });
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 200 },
      scrollHeight: { configurable: true, value: 600 },
    });
    viewport.scrollTop = 100;
    fireEvent.scroll(viewport);

    act(() => {
      mocks.receivedMessageListener?.({
        ...latestMessage,
        id: "delayed-message",
        content: "Evento atrasado",
        createdAt: "2026-07-29T12:34:00.000Z",
      });
    });

    expect(screen.getByText("Evento atrasado")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Novas mensagens" }),
    ).toBeTruthy();
    expect(viewport.scrollTop).toBe(100);
  });

  it("translates a message and toggles the cached original", async () => {
    const originalMessage = {
      ...message,
      participantId: "participant-2",
      participantName: "Maria",
      content: "Hello",
    };
    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [originalMessage],
      nextCursor: null,
    });
    mocks.translateChatMessage.mockResolvedValue({
      messageId: originalMessage.id,
      originalContent: "Hello",
      translatedContent: "Olá",
      targetLanguage: "PT-BR",
    });
    renderChatSection();

    await screen.findByText("Hello");
    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Traduzir mensagem de Maria",
      })[0]!,
    );

    expect(await screen.findByText("Olá")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver original mensagem de Maria",
      }),
    );
    expect(screen.getByText("Hello")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver tradução mensagem de Maria",
      }),
    );
    expect(screen.getByText("Olá")).toBeTruthy();
    expect(mocks.translateChatMessage).toHaveBeenCalledOnce();
  });

  it("disables translation without a target language", async () => {
    useRoomSessionStore.setState((state) => ({
      ...state,
      participant: state.participant
        ? { ...state.participant, targetLanguage: null }
        : null,
    }));
    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [message],
      nextCursor: null,
    });
    renderChatSection();

    await screen.findByText("Olá");
    expect(
      screen.getByText("Selecione um idioma de destino válido para traduzir."),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", {
          name: "Traduzir mensagem de Danilo",
        })
        .getAttribute("aria-disabled"),
    ).toBe("true");
    expect(mocks.translateChatMessage).not.toHaveBeenCalled();
  });

  it("runs history, send, receive and translation in one mounted flow", async () => {
    const historyMessage = {
      ...message,
      id: "history-message",
      participantId: "participant-2",
      participantName: "Maria",
      content: "Hello",
      createdAt: "2026-07-29T12:30:00.000Z",
    };
    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [historyMessage],
      nextCursor: null,
    });
    mocks.sendChatMessage.mockResolvedValue({
      ...message,
      id: "sent-message",
      content: "Minha mensagem",
      createdAt: "2026-07-29T12:31:00.000Z",
    });
    mocks.translateChatMessage.mockResolvedValue({
      messageId: historyMessage.id,
      originalContent: historyMessage.content,
      translatedContent: "Olá",
      targetLanguage: "PT-BR",
    });
    renderChatSection();

    expect(await screen.findByText("Hello")).toBeTruthy();

    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "Minha mensagem" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    expect(await screen.findByText("Minha mensagem")).toBeTruthy();

    act(() => {
      mocks.receivedMessageListener?.({
        ...message,
        id: "received-message",
        participantId: "participant-2",
        participantName: "Maria",
        content: "Mensagem remota",
        createdAt: "2026-07-29T12:32:00.000Z",
      });
    });
    expect(screen.getByText("Mensagem remota")).toBeTruthy();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Traduzir mensagem de Maria",
      })[0]!,
    );
    expect(await screen.findByText("Olá")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Ver original mensagem de Maria",
      }),
    );
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("aborts translation and removes live listeners when unmounted", async () => {
    let translationSignal: AbortSignal | undefined;
    mocks.listChatMessages.mockResolvedValueOnce({
      messages: [
        {
          ...message,
          participantId: "participant-2",
          participantName: "Maria",
          content: "Hello",
        },
      ],
      nextCursor: null,
    });
    mocks.translateChatMessage.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        translationSignal = signal;
        return new Promise(() => undefined);
      },
    );
    const view = renderChatSection();

    await screen.findByText("Hello");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Traduzir mensagem de Maria",
      }),
    );
    await waitFor(() => {
      expect(translationSignal?.aborted).toBe(false);
    });

    view.unmount();

    expect(translationSignal?.aborted).toBe(true);
    expect(mocks.receivedMessageListener).toBeUndefined();
  });
});
