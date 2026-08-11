import type {
  ChatMessagesListPayload,
  ChatMessage,
  ChatMessageTranslation,
  ListChatMessagesPayload,
  NormalizedChatError,
  SendChatMessagePayload,
  TranslateChatMessageInput,
} from "@/core/@types/chat";
import type { SocketEventErrorPayload } from "@/core/@types/socket-events";
import { isDeepLTargetLanguage } from "@/core/components/selector-country/countryList";
import { api } from "@/core/services/api-service";
import { getSocket } from "@/core/services/socket-service";

export const CHAT_OPERATION_TIMEOUT_MS = 8_000;

export class ChatConnectionError extends Error {
  constructor() {
    super("A conexão com o chat foi interrompida. Tente novamente.");
    this.name = "ChatConnectionError";
  }
}

export class ChatOperationTimeoutError extends Error {
  constructor(
    message = "O servidor demorou para confirmar o envio. Tente novamente.",
  ) {
    super(message);
    this.name = "ChatOperationTimeoutError";
  }
}

export class ChatOperationAbortedError extends Error {
  constructor() {
    super("A operação do chat foi cancelada.");
    this.name = "ChatOperationAbortedError";
  }
}

export class ChatServerError extends Error {
  readonly code?: string;
  readonly event?: string;
  readonly issues?: unknown;

  constructor(error: NormalizedChatError) {
    super(error.message);
    this.name = "ChatServerError";
    this.code = error.code;
    this.event = error.event;
    this.issues = error.issues;
  }
}

export class InvalidChatResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidChatResponseError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isChatMessagesListPayload(
  value: unknown,
): value is ChatMessagesListPayload {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ChatMessagesListPayload>;

  return (
    Array.isArray(candidate.messages) &&
    candidate.messages.every(isChatMessage) &&
    (candidate.nextCursor === null || isNonEmptyString(candidate.nextCursor))
  );
}

export function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ChatMessage>;

  return (
    isNonEmptyString(candidate.id) &&
    isNonEmptyString(candidate.roomId) &&
    isNonEmptyString(candidate.participantId) &&
    isNonEmptyString(candidate.participantName) &&
    typeof candidate.content === "string" &&
    (candidate.sourceLanguage === null ||
      isDeepLTargetLanguage(candidate.sourceLanguage)) &&
    isNonEmptyString(candidate.createdAt)
  );
}

export function normalizeChatSocketError(
  value: unknown,
): NormalizedChatError | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as {
    event?: unknown;
    code?: unknown;
    message?: unknown;
    issues?: unknown;
  };

  if (!isNonEmptyString(candidate.message)) return null;

  return {
    message: candidate.message,
    ...(isNonEmptyString(candidate.event)
      ? { event: candidate.event }
      : undefined),
    ...(isNonEmptyString(candidate.code)
      ? { code: candidate.code }
      : undefined),
    ...(candidate.issues !== undefined
      ? { issues: candidate.issues }
      : undefined),
  };
}

type SendChatMessageInput = SendChatMessagePayload & {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function sendChatMessage({
  roomId,
  content,
  sourceLanguage,
  signal,
  timeoutMs = CHAT_OPERATION_TIMEOUT_MS,
}: SendChatMessageInput) {
  const socket = getSocket();

  if (!socket.connected) {
    return Promise.reject(new ChatConnectionError());
  }

  if (signal?.aborted) {
    return Promise.reject(new ChatOperationAbortedError());
  }

  return new Promise<ChatMessage>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      socket.off("message_sent", handleMessageSent);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);
      signal?.removeEventListener("abort", handleAbort);
      clearTimeout(timeoutId);
    };

    const finish = (
      callback: (value: ChatMessage | Error) => void,
      value: ChatMessage | Error,
    ) => {
      if (settled) return;

      settled = true;
      cleanup();
      callback(value);
    };

    const handleMessageSent = (message: ChatMessage) => {
      if (
        !isChatMessage(message) ||
        message.roomId !== roomId ||
        message.content !== content ||
        message.sourceLanguage !== sourceLanguage
      ) {
        return;
      }

      finish((value) => resolve(value as ChatMessage), message);
    };

    const handleError = (payload: SocketEventErrorPayload) => {
      const error = normalizeChatSocketError(payload as unknown);
      if (!error) return;
      if (error.event && error.event !== "send_message") return;

      finish((value) => reject(value), new ChatServerError(error));
    };

    const handleDisconnect = () => {
      finish((value) => reject(value), new ChatConnectionError());
    };

    const handleAbort = () => {
      finish((value) => reject(value), new ChatOperationAbortedError());
    };

    const timeoutId = setTimeout(() => {
      finish((value) => reject(value), new ChatOperationTimeoutError());
    }, timeoutMs);

    socket.on("message_sent", handleMessageSent);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);
    signal?.addEventListener("abort", handleAbort, { once: true });
    socket.emit("send_message", { roomId, content, sourceLanguage });
  });
}

type ListChatMessagesInput = ListChatMessagesPayload & {
  signal?: AbortSignal;
  timeoutMs?: number;
};

export function listChatMessages({
  roomId,
  limit = 30,
  before,
  signal,
  timeoutMs = CHAT_OPERATION_TIMEOUT_MS,
}: ListChatMessagesInput) {
  const socket = getSocket();

  if (!socket.connected) {
    return Promise.reject(new ChatConnectionError());
  }

  if (signal?.aborted) {
    return Promise.reject(new ChatOperationAbortedError());
  }

  return new Promise<ChatMessagesListPayload>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      socket.off("messages_list", handleMessagesList);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);
      signal?.removeEventListener("abort", handleAbort);
      clearTimeout(timeoutId);
    };

    const finish = (
      callback: (value: ChatMessagesListPayload | Error) => void,
      value: ChatMessagesListPayload | Error,
    ) => {
      if (settled) return;

      settled = true;
      cleanup();
      callback(value);
    };

    const handleMessagesList = (payload: ChatMessagesListPayload) => {
      if (!isChatMessagesListPayload(payload)) {
        finish(
          (value) => reject(value),
          new InvalidChatResponseError(
            "O servidor retornou um histórico de mensagens inválido.",
          ),
        );
        return;
      }

      if (payload.messages.some((message) => message.roomId !== roomId)) {
        finish(
          (value) => reject(value),
          new InvalidChatResponseError(
            "O servidor retornou mensagens de outra sala.",
          ),
        );
        return;
      }

      finish((value) => resolve(value as ChatMessagesListPayload), payload);
    };

    const handleError = (payload: SocketEventErrorPayload) => {
      const error = normalizeChatSocketError(payload as unknown);
      if (!error) return;
      if (error.event && error.event !== "list_messages") return;

      finish((value) => reject(value), new ChatServerError(error));
    };

    const handleDisconnect = () => {
      finish((value) => reject(value), new ChatConnectionError());
    };

    const handleAbort = () => {
      finish((value) => reject(value), new ChatOperationAbortedError());
    };

    const timeoutId = setTimeout(() => {
      finish(
        (value) => reject(value),
        new ChatOperationTimeoutError(
          "O servidor demorou para carregar o histórico. Tente novamente.",
        ),
      );
    }, timeoutMs);

    socket.on("messages_list", handleMessagesList);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);
    signal?.addEventListener("abort", handleAbort, { once: true });
    socket.emit("list_messages", {
      roomId,
      limit,
      ...(before ? { before } : undefined),
    });
  });
}

export function subscribeToReceivedChatMessages({
  roomId,
  onMessage,
}: {
  roomId: string;
  onMessage: (message: ChatMessage) => void;
}) {
  const socket = getSocket();

  const handleMessageReceived = (message: ChatMessage) => {
    if (!isChatMessage(message) || message.roomId !== roomId) return;
    onMessage(message);
  };

  socket.on("message_received", handleMessageReceived);

  return () => {
    socket.off("message_received", handleMessageReceived);
  };
}

export async function translateChatMessage({
  messageId,
  targetLanguage,
  signal,
}: TranslateChatMessageInput) {
  const response = await api.post<ChatMessageTranslation>(
    `/messages/${messageId}/translate`,
    { targetLanguage },
    { signal },
  );

  return response.data;
}

export function isChatConnected() {
  try {
    return getSocket().connected;
  } catch {
    return false;
  }
}

export function subscribeToChatConnection(
  listener: (isConnected: boolean) => void,
) {
  const socket = getSocket();
  const handleConnect = () => listener(true);
  const handleDisconnect = () => listener(false);

  socket.on("connect", handleConnect);
  socket.on("disconnect", handleDisconnect);
  listener(socket.connected);

  return () => {
    socket.off("connect", handleConnect);
    socket.off("disconnect", handleDisconnect);
  };
}
