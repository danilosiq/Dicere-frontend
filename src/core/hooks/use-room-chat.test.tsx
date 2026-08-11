import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendChatMessage: vi.fn(),
  listChatMessages: vi.fn(),
  receivedMessageListener: undefined as
    ((message: import("@/core/@types/chat").ChatMessage) => void) | undefined,
  unsubscribeReceivedMessages: vi.fn(),
  lifecycleOrder: [] as string[],
  connectionListener: undefined as ((isConnected: boolean) => void) | undefined,
}));

vi.mock("@/core/services/chat-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/core/services/chat-service")
  >("@/core/services/chat-service");

  return {
    ...actual,
    isChatConnected: () => true,
    listChatMessages: (...args: unknown[]) => {
      mocks.lifecycleOrder.push("list");
      return mocks.listChatMessages(...args);
    },
    sendChatMessage: mocks.sendChatMessage,
    subscribeToReceivedChatMessages: ({
      onMessage,
    }: {
      onMessage: (message: import("@/core/@types/chat").ChatMessage) => void;
    }) => {
      mocks.lifecycleOrder.push("subscribe");
      mocks.receivedMessageListener = onMessage;
      return mocks.unsubscribeReceivedMessages;
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

import { MAX_CHAT_MESSAGE_CHARACTERS } from "@/core/@types/chat";
import { useRoomChat as useRoomChatBase } from "@/core/hooks/use-room-chat";

function useRoomChat(
  params: Parameters<typeof useRoomChatBase>[0],
): ReturnType<typeof useRoomChatBase> {
  const chat = useRoomChatBase(params);
  const { setSourceLanguage } = chat;

  useEffect(() => {
    setSourceLanguage("PT-BR");
  }, [setSourceLanguage]);

  return chat;
}

const message = {
  id: "message-id",
  roomId: "room-id",
  participantId: "participant-id",
  participantName: "Danilo",
  content: "Olá",
  sourceLanguage: "PT-BR" as const,
  createdAt: "2026-07-29T00:00:00.000Z",
};

describe("useRoomChat sending", () => {
  beforeEach(() => {
    mocks.sendChatMessage.mockReset();
    mocks.listChatMessages.mockReset();
    mocks.listChatMessages.mockResolvedValue({
      messages: [],
      nextCursor: null,
    });
    mocks.receivedMessageListener = undefined;
    mocks.unsubscribeReceivedMessages.mockReset();
    mocks.lifecycleOrder.length = 0;
    mocks.connectionListener = undefined;
  });

  it("blocks sending until a source language is selected", async () => {
    mocks.sendChatMessage.mockResolvedValue(message);
    const { result } = renderHook(() =>
      useRoomChatBase({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });

    act(() => {
      result.current.setDraft("Olá");
    });

    expect(result.current.canSend).toBe(false);
    expect(result.current.validationError).toBe(
      "Selecione o idioma em que você está escrevendo.",
    );

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(false);
    });
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();

    act(() => {
      result.current.setSourceLanguage("PT-BR");
    });

    expect(result.current.canSend).toBe(true);
    expect(result.current.sendError).toBeNull();

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(true);
    });
    expect(mocks.sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-id",
        content: "Olá",
        sourceLanguage: "PT-BR",
      }),
    );
  });

  it("uses the current language per message and resets it when the room changes", async () => {
    mocks.sendChatMessage
      .mockResolvedValueOnce({
        ...message,
        id: "first-message",
        content: "Primeira",
      })
      .mockResolvedValueOnce({
        ...message,
        id: "second-message",
        content: "Second",
        sourceLanguage: "EN",
      });
    const { result, rerender } = renderHook(
      ({ roomId }: { roomId: string }) =>
        useRoomChatBase({ roomId, participantId: "participant-id" }),
      { initialProps: { roomId: "room-id" } },
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });

    act(() => {
      result.current.setSourceLanguage("PT-BR");
      result.current.setDraft("Primeira");
    });
    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(true);
    });

    act(() => {
      result.current.setSourceLanguage("EN");
      result.current.setDraft("Second");
    });
    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(true);
    });

    expect(mocks.sendChatMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sourceLanguage: "PT-BR" }),
    );
    expect(mocks.sendChatMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sourceLanguage: "EN" }),
    );

    rerender({ roomId: "room-2" });
    expect(result.current.sourceLanguage).toBeUndefined();
  });

  it("blocks empty and oversized messages before calling the service", async () => {
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.sendError).toBe(
      "Escreva uma mensagem antes de enviar.",
    );

    act(() => {
      result.current.setDraft("a".repeat(MAX_CHAT_MESSAGE_CHARACTERS + 1));
    });

    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.sendError).toContain("no máximo 250");
    expect(mocks.sendChatMessage).not.toHaveBeenCalled();
  });

  it("adds the confirmed message and clears the draft only on success", async () => {
    mocks.sendChatMessage.mockResolvedValue(message);
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    act(() => {
      result.current.setDraft("  Olá  ");
    });

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(true);
    });

    expect(mocks.sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-id",
        content: "Olá",
      }),
    );
    expect(result.current.messages).toEqual([message]);
    expect(result.current.draft).toBe("");
    expect(result.current.sendError).toBeNull();
  });

  it("preserves the draft on failure and allows retry", async () => {
    mocks.sendChatMessage
      .mockRejectedValueOnce(new Error("Falha ao enviar"))
      .mockResolvedValueOnce(message);
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    act(() => {
      result.current.setDraft("Olá");
    });

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(false);
    });

    expect(result.current.draft).toBe("Olá");
    expect(result.current.sendError).toBe("Falha ao enviar");

    await act(async () => {
      await expect(result.current.retrySend()).resolves.toBe(true);
    });

    expect(mocks.sendChatMessage).toHaveBeenCalledTimes(2);
    expect(result.current.draft).toBe("");
  });

  it("prevents concurrent sends and reacts to socket disconnection", async () => {
    let resolveMessage: ((value: typeof message) => void) | undefined;
    mocks.sendChatMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMessage = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    act(() => {
      result.current.setDraft("Olá");
    });

    let firstSend: Promise<boolean>;
    act(() => {
      firstSend = result.current.sendMessage();
      void result.current.sendMessage();
    });

    expect(mocks.sendChatMessage).toHaveBeenCalledOnce();

    await act(async () => {
      resolveMessage?.(message);
      await firstSend;
    });

    act(() => {
      mocks.connectionListener?.(false);
      result.current.setDraft("Outra mensagem");
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(false);
    });

    expect(mocks.sendChatMessage).toHaveBeenCalledOnce();
    expect(result.current.sendError).toContain("conexão");
  });

  it("does not duplicate a repeated confirmation id", async () => {
    mocks.sendChatMessage.mockResolvedValue(message);
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    act(() => result.current.setDraft("Primeira"));
    await act(async () => {
      await result.current.sendMessage();
    });

    act(() => result.current.setDraft("Segunda"));
    await act(async () => {
      await result.current.sendMessage();
    });

    expect(result.current.messages).toHaveLength(1);
  });

  it("accepts exactly 250 normalized characters", async () => {
    const content = "a".repeat(MAX_CHAT_MESSAGE_CHARACTERS);
    mocks.sendChatMessage.mockResolvedValue({ ...message, content });
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });
    act(() => result.current.setDraft(` ${content} `));

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(true);
    });

    expect(result.current.characterCount).toBe(0);
    expect(mocks.sendChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content }),
    );
  });

  it("preserves text typed while a previous message is being confirmed", async () => {
    let resolveSend: ((value: typeof message) => void) | undefined;
    mocks.sendChatMessage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });
    act(() => result.current.setDraft("Primeira mensagem"));

    let send: Promise<boolean>;
    act(() => {
      send = result.current.sendMessage();
    });
    act(() => result.current.setDraft("Próxima mensagem"));

    await act(async () => {
      resolveSend?.({ ...message, content: "Primeira mensagem" });
      await send;
    });

    expect(result.current.draft).toBe("Próxima mensagem");
    expect(result.current.messages).toHaveLength(1);
  });

  it("scopes sending errors to the current room", async () => {
    mocks.sendChatMessage.mockRejectedValue(new Error("Falha na sala A"));
    const { result, rerender } = renderHook(
      ({ roomId }) =>
        useRoomChat({
          roomId,
          participantId: "participant-id",
        }),
      { initialProps: { roomId: "room-id" } },
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });
    act(() => result.current.setDraft("Mensagem"));
    await act(async () => {
      await result.current.sendMessage();
    });
    expect(result.current.sendError).toBe("Falha na sala A");

    rerender({ roomId: "room-2" });

    expect(result.current.sendError).toBeNull();
    expect(result.current.isSending).toBe(false);
  });

  it("does not overlap sending with a pending history request", async () => {
    mocks.listChatMessages.mockImplementation(
      () => new Promise(() => undefined),
    );
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.isInitialLoading).toBe(true);
    });
    act(() => result.current.setDraft("Mensagem"));

    await act(async () => {
      await expect(result.current.sendMessage()).resolves.toBe(false);
    });

    expect(mocks.sendChatMessage).not.toHaveBeenCalled();
    expect(result.current.sendError).toBe(
      "Aguarde o carregamento das mensagens antes de enviar.",
    );
  });

  it("aborts a pending send when the chat unmounts", async () => {
    let sendSignal: AbortSignal | undefined;
    mocks.sendChatMessage.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        sendSignal = signal;
        return new Promise(() => undefined);
      },
    );
    const { result, unmount } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });
    act(() => result.current.setDraft("Mensagem"));
    act(() => {
      void result.current.sendMessage();
    });
    expect(sendSignal?.aborted).toBe(false);

    unmount();

    expect(sendSignal?.aborted).toBe(true);
  });
});

describe("useRoomChat history and live messages", () => {
  beforeEach(() => {
    mocks.sendChatMessage.mockReset();
    mocks.listChatMessages.mockReset();
    mocks.listChatMessages.mockResolvedValue({
      messages: [],
      nextCursor: null,
    });
    mocks.receivedMessageListener = undefined;
    mocks.unsubscribeReceivedMessages.mockReset();
    mocks.lifecycleOrder.length = 0;
    mocks.connectionListener = undefined;
  });

  it("subscribes to live messages before requesting the initial history", async () => {
    renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(mocks.listChatMessages).toHaveBeenCalledOnce();
    });

    expect(mocks.lifecycleOrder.slice(0, 2)).toEqual(["subscribe", "list"]);
    expect(mocks.listChatMessages).toHaveBeenCalledWith(
      expect.objectContaining({
        roomId: "room-id",
        limit: 30,
        before: undefined,
      }),
    );
  });

  it("merges a live event received during history loading without duplicates and in order", async () => {
    let resolveHistory:
      | ((value: {
          messages: Array<typeof message>;
          nextCursor: string | null;
        }) => void)
      | undefined;
    mocks.listChatMessages.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveHistory = resolve;
        }),
    );
    const liveMessage = {
      ...message,
      id: "message-live",
      participantId: "participant-2",
      participantName: "Maria",
      createdAt: "2026-07-29T00:02:00.000Z",
    };
    const olderMessage = {
      ...message,
      id: "message-old",
      createdAt: "2026-07-29T00:01:00.000Z",
    };
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(mocks.receivedMessageListener).toBeTypeOf("function");
      expect(mocks.listChatMessages).toHaveBeenCalledOnce();
    });

    act(() => {
      mocks.receivedMessageListener?.(liveMessage);
    });

    expect(result.current.messages).toEqual([liveMessage]);

    await act(async () => {
      resolveHistory?.({
        messages: [liveMessage, olderMessage],
        nextCursor: "2026-07-28T23:00:00.000Z",
      });
      await Promise.resolve();
    });

    expect(result.current.messages.map(({ id }) => id)).toEqual([
      "message-old",
      "message-live",
    ]);
    expect(result.current.nextCursor).toBe("2026-07-28T23:00:00.000Z");
    expect(result.current.hasLoadedInitial).toBe(true);
  });

  it("ignores another room and deterministically sorts equal timestamps by id", async () => {
    mocks.listChatMessages.mockResolvedValue({
      messages: [
        { ...message, id: "b-message" },
        { ...message, id: "a-message" },
        { ...message, id: "other-room", roomId: "another-room" },
      ],
      nextCursor: null,
    });
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.hasLoadedInitial).toBe(true);
    });

    expect(result.current.messages.map(({ id }) => id)).toEqual([
      "a-message",
      "b-message",
    ]);
  });

  it("loads older messages with nextCursor and preserves current messages on error", async () => {
    const currentMessage = {
      ...message,
      id: "current-message",
      createdAt: "2026-07-29T00:02:00.000Z",
    };
    const olderMessage = {
      ...message,
      id: "older-message",
      createdAt: "2026-07-29T00:01:00.000Z",
    };
    mocks.listChatMessages
      .mockResolvedValueOnce({
        messages: [currentMessage],
        nextCursor: "2026-07-29T00:02:00.000Z",
      })
      .mockRejectedValueOnce(new Error("Falha ao carregar anteriores"))
      .mockResolvedValueOnce({
        messages: [olderMessage],
        nextCursor: null,
      });
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.messages).toEqual([currentMessage]);
    });

    await act(async () => {
      await expect(result.current.loadOlder()).resolves.toBe(false);
    });

    expect(result.current.messages).toEqual([currentMessage]);
    expect(result.current.olderError).toBe("Falha ao carregar anteriores");
    expect(mocks.listChatMessages).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        before: "2026-07-29T00:02:00.000Z",
        limit: 30,
      }),
    );

    await act(async () => {
      await expect(result.current.retryOlder()).resolves.toBe(true);
    });

    expect(result.current.messages.map(({ id }) => id)).toEqual([
      "older-message",
      "current-message",
    ]);
    expect(result.current.nextCursor).toBeNull();
    expect(result.current.olderError).toBeNull();
  });

  it("shows an initial error, keeps live messages and retries without clearing them", async () => {
    mocks.listChatMessages
      .mockRejectedValueOnce(new Error("Falha no histórico"))
      .mockResolvedValueOnce({ messages: [], nextCursor: null });
    const liveMessage = {
      ...message,
      id: "live-during-error",
      participantId: "participant-2",
    };
    const { result } = renderHook(() =>
      useRoomChat({
        roomId: "room-id",
        participantId: "participant-id",
      }),
    );

    await waitFor(() => {
      expect(result.current.initialError).toBe("Falha no histórico");
    });

    act(() => {
      mocks.receivedMessageListener?.(liveMessage);
    });

    await act(async () => {
      await expect(result.current.retryHistory()).resolves.toBe(true);
    });

    expect(result.current.messages).toEqual([liveMessage]);
    expect(result.current.initialError).toBeNull();
  });

  it("drains an old room history before requesting the new room and aborts on unmount", async () => {
    const signals: AbortSignal[] = [];
    const resolvers: Array<
      (value: { messages: never[]; nextCursor: null }) => void
    > = [];
    mocks.listChatMessages.mockImplementation(
      ({ signal }: { signal: AbortSignal }) => {
        signals.push(signal);
        return new Promise((resolve) => {
          resolvers.push(resolve);
        });
      },
    );
    const { result, rerender, unmount } = renderHook(
      ({ roomId }: { roomId: string }) =>
        useRoomChat({ roomId, participantId: "participant-id" }),
      { initialProps: { roomId: "room-id" } },
    );

    await waitFor(() => {
      expect(signals).toHaveLength(1);
    });

    rerender({ roomId: "room-2" });

    expect(signals[0]?.aborted).toBe(false);
    expect(signals).toHaveLength(1);
    expect(result.current.messages).toEqual([]);
    expect(mocks.unsubscribeReceivedMessages).toHaveBeenCalled();

    await act(async () => {
      resolvers[0]?.({ messages: [], nextCursor: null });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(signals).toHaveLength(2);
    });

    unmount();
    expect(signals[1]?.aborted).toBe(true);
  });

  it("does not duplicate the initial request under Strict Mode", async () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );

    renderHook(
      () =>
        useRoomChat({
          roomId: "room-id",
          participantId: "participant-id",
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(mocks.listChatMessages).toHaveBeenCalledOnce();
    });
  });
});
