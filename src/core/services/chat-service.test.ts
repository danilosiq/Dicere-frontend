import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const socketMock = vi.hoisted(() => {
  type Listener = (...args: never[]) => void;
  const listeners = new Map<string, Set<Listener>>();

  const socket = {
    connected: true,
    on: vi.fn((event: string, listener: Listener) => {
      const eventListeners = listeners.get(event) ?? new Set();
      eventListeners.add(listener);
      listeners.set(event, eventListeners);
      return socket;
    }),
    off: vi.fn((event: string, listener: Listener) => {
      listeners.get(event)?.delete(listener);
      return socket;
    }),
    emit: vi.fn((event: string, payload?: unknown) => {
      void event;
      void payload;
      return socket;
    }),
  };

  return {
    socket,
    emitFromServer(event: string, payload?: unknown) {
      for (const listener of listeners.get(event) ?? []) {
        listener(payload as never);
      }
    },
    listenerCount(event: string) {
      return listeners.get(event)?.size ?? 0;
    },
    reset() {
      listeners.clear();
      socket.connected = true;
      socket.on.mockClear();
      socket.off.mockClear();
      socket.emit.mockClear();
    },
  };
});

const apiMock = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/core/services/socket-service", () => ({
  getSocket: () => socketMock.socket,
}));

vi.mock("@/core/services/api-service", () => ({
  api: apiMock,
}));

import {
  ChatConnectionError,
  ChatOperationAbortedError,
  ChatOperationTimeoutError,
  ChatServerError,
  InvalidChatResponseError,
  listChatMessages,
  sendChatMessage,
  subscribeToChatConnection,
  subscribeToReceivedChatMessages,
  translateChatMessage,
} from "@/core/services/chat-service";

const message = {
  id: "message-id",
  roomId: "room-id",
  participantId: "participant-id",
  participantName: "Danilo",
  content: "Olá",
  sourceLanguage: "PT-BR" as const,
  createdAt: "2026-07-29T00:00:00.000Z",
};

describe("chat-service", () => {
  beforeEach(() => {
    socketMock.reset();
    apiMock.post.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers confirmation listeners before emitting and resolves the server message", async () => {
    socketMock.socket.emit.mockImplementationOnce(
      (event: string, payload?: unknown) => {
        expect(event).toBe("send_message");
        expect(payload).toEqual({
          roomId: "room-id",
          content: "Olá",
          sourceLanguage: "PT-BR",
        });
        expect(socketMock.listenerCount("message_sent")).toBe(1);
        socketMock.emitFromServer("message_sent", message);
        return socketMock.socket;
      },
    );

    await expect(
      sendChatMessage({
        roomId: "room-id",
        content: "Olá",
        sourceLanguage: "PT-BR",
      }),
    ).resolves.toEqual(message);

    expect(socketMock.listenerCount("message_sent")).toBe(0);
    expect(socketMock.listenerCount("error")).toBe(0);
    expect(socketMock.listenerCount("disconnect")).toBe(0);
  });

  it("ignores confirmations from another room", async () => {
    vi.useFakeTimers();

    const pendingMessage = sendChatMessage({
      roomId: "room-id",
      content: "Olá",
      sourceLanguage: "PT-BR",
      timeoutMs: 100,
    });
    const rejection = expect(pendingMessage).rejects.toBeInstanceOf(
      ChatOperationTimeoutError,
    );

    socketMock.emitFromServer("message_sent", {
      ...message,
      roomId: "another-room",
    });
    await vi.advanceTimersByTimeAsync(100);

    await rejection;
  });

  it("ignores a same-room confirmation for different content", async () => {
    const pendingMessage = sendChatMessage({
      roomId: "room-id",
      content: "Mensagem atual",
      sourceLanguage: "PT-BR",
    });

    socketMock.emitFromServer("message_sent", {
      ...message,
      content: "Confirmação anterior",
    });
    expect(socketMock.listenerCount("message_sent")).toBe(1);

    const confirmedMessage = { ...message, content: "Mensagem atual" };
    socketMock.emitFromServer("message_sent", confirmedMessage);

    await expect(pendingMessage).resolves.toEqual(confirmedMessage);
  });

  it("normalizes legacy server errors and cleans the pending listeners", async () => {
    const pendingMessage = sendChatMessage({
      roomId: "room-id",
      content: "Olá",
      sourceLanguage: "PT-BR",
    });

    socketMock.emitFromServer("error", { message: "Sala não está ativa" });

    await expect(pendingMessage).rejects.toMatchObject({
      message: "Sala não está ativa",
    } satisfies Partial<ChatServerError>);
    expect(socketMock.listenerCount("message_sent")).toBe(0);
  });

  it("rejects immediately when the socket is disconnected", async () => {
    socketMock.socket.connected = false;

    await expect(
      sendChatMessage({
        roomId: "room-id",
        content: "Olá",
        sourceLanguage: "PT-BR",
      }),
    ).rejects.toBeInstanceOf(ChatConnectionError);
    expect(socketMock.socket.emit).not.toHaveBeenCalled();
  });

  it("cancels a pending send through AbortSignal", async () => {
    const controller = new AbortController();
    const pendingMessage = sendChatMessage({
      roomId: "room-id",
      content: "Olá",
      sourceLanguage: "PT-BR",
      signal: controller.signal,
    });

    controller.abort();

    await expect(pendingMessage).rejects.toBeInstanceOf(
      ChatOperationAbortedError,
    );
    expect(socketMock.listenerCount("message_sent")).toBe(0);
  });

  it("reports connection changes and removes its listeners", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToChatConnection(listener);

    expect(listener).toHaveBeenCalledWith(true);

    socketMock.emitFromServer("disconnect");
    socketMock.socket.connected = false;
    socketMock.emitFromServer("connect");

    expect(listener).toHaveBeenNthCalledWith(2, false);
    expect(listener).toHaveBeenNthCalledWith(3, true);

    unsubscribe();
    expect(socketMock.listenerCount("connect")).toBe(0);
    expect(socketMock.listenerCount("disconnect")).toBe(0);
  });

  it("registers the history response before requesting the first 30 messages", async () => {
    socketMock.socket.emit.mockImplementationOnce(
      (event: string, payload?: unknown) => {
        expect(event).toBe("list_messages");
        expect(payload).toEqual({ roomId: "room-id", limit: 30 });
        expect(socketMock.listenerCount("messages_list")).toBe(1);
        socketMock.emitFromServer("messages_list", {
          messages: [message],
          nextCursor: "2026-07-28T23:59:00.000Z",
        });
        return socketMock.socket;
      },
    );

    await expect(listChatMessages({ roomId: "room-id" })).resolves.toEqual({
      messages: [message],
      nextCursor: "2026-07-28T23:59:00.000Z",
    });

    expect(socketMock.listenerCount("messages_list")).toBe(0);
    expect(socketMock.listenerCount("error")).toBe(0);
    expect(socketMock.listenerCount("disconnect")).toBe(0);
  });

  it("requests an older page with before and the provided limit", async () => {
    const before = "2026-07-28T23:59:00.000Z";
    const pendingHistory = listChatMessages({
      roomId: "room-id",
      limit: 20,
      before,
    });

    expect(socketMock.socket.emit).toHaveBeenCalledWith("list_messages", {
      roomId: "room-id",
      limit: 20,
      before,
    });

    socketMock.emitFromServer("messages_list", {
      messages: [],
      nextCursor: null,
    });

    await expect(pendingHistory).resolves.toEqual({
      messages: [],
      nextCursor: null,
    });
  });

  it("rejects incompatible history payloads and messages from another room", async () => {
    const invalidHistory = listChatMessages({ roomId: "room-id" });
    socketMock.emitFromServer("messages_list", {
      messages: [{ ...message, id: "" }],
      nextCursor: null,
    });

    await expect(invalidHistory).rejects.toBeInstanceOf(
      InvalidChatResponseError,
    );

    const wrongRoomHistory = listChatMessages({ roomId: "room-id" });
    socketMock.emitFromServer("messages_list", {
      messages: [{ ...message, roomId: "another-room" }],
      nextCursor: null,
    });

    await expect(wrongRoomHistory).rejects.toBeInstanceOf(
      InvalidChatResponseError,
    );
  });

  it("times out and cancels history requests without leaking listeners", async () => {
    vi.useFakeTimers();
    const timedOutHistory = listChatMessages({
      roomId: "room-id",
      timeoutMs: 100,
    });
    const timeoutAssertion = expect(timedOutHistory).rejects.toBeInstanceOf(
      ChatOperationTimeoutError,
    );

    await vi.advanceTimersByTimeAsync(100);
    await timeoutAssertion;

    expect(socketMock.listenerCount("messages_list")).toBe(0);

    const controller = new AbortController();
    const cancelledHistory = listChatMessages({
      roomId: "room-id",
      signal: controller.signal,
    });
    controller.abort();

    await expect(cancelledHistory).rejects.toBeInstanceOf(
      ChatOperationAbortedError,
    );
    expect(socketMock.listenerCount("messages_list")).toBe(0);
    expect(socketMock.listenerCount("error")).toBe(0);
  });

  it("subscribes only to valid remote messages from the active room", () => {
    const onMessage = vi.fn();
    const unsubscribe = subscribeToReceivedChatMessages({
      roomId: "room-id",
      onMessage,
    });

    socketMock.emitFromServer("message_received", {
      ...message,
      id: "remote-message",
      participantId: "remote-participant",
    });
    socketMock.emitFromServer("message_received", {
      ...message,
      id: "other-room-message",
      roomId: "another-room",
    });
    socketMock.emitFromServer("message_received", {
      ...message,
      id: "",
    });

    expect(onMessage).toHaveBeenCalledOnce();
    expect(onMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "remote-message" }),
    );

    unsubscribe();
    expect(socketMock.listenerCount("message_received")).toBe(0);
  });

  it("translates a persisted message through the HTTP API", async () => {
    const controller = new AbortController();
    const translation = {
      messageId: "message-id",
      originalContent: "Hello",
      translatedContent: "Olá",
      targetLanguage: "PT-BR",
    };
    apiMock.post.mockResolvedValue({ data: translation });

    await expect(
      translateChatMessage({
        messageId: "message-id",
        targetLanguage: "PT-BR",
        signal: controller.signal,
      }),
    ).resolves.toEqual(translation);

    expect(apiMock.post).toHaveBeenCalledWith(
      "/messages/message-id/translate",
      { targetLanguage: "PT-BR" },
      { signal: controller.signal },
    );
  });

  it("propagates translation API errors unchanged", async () => {
    const error = new Error("Translation unavailable");
    apiMock.post.mockRejectedValue(error);

    await expect(
      translateChatMessage({
        messageId: "message-id",
        targetLanguage: "PT-BR",
      }),
    ).rejects.toBe(error);
  });
});
