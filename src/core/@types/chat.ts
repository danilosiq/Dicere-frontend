import type { DeepLTargetLanguage } from "@/core/components";

export const MAX_CHAT_MESSAGE_CHARACTERS = 250;

export type ChatMessage = {
  id: string;
  roomId: string;
  participantId: string;
  participantName: string;
  content: string;
  sourceLanguage: DeepLTargetLanguage | null;
  createdAt: string;
};

export type SendChatMessagePayload = {
  roomId: string;
  content: string;
  sourceLanguage: DeepLTargetLanguage;
};

export type ListChatMessagesPayload = {
  roomId: string;
  limit?: number;
  before?: string;
};

export type ChatMessagesListPayload = {
  messages: ChatMessage[];
  nextCursor: string | null;
};

export type TranslateChatMessageInput = {
  messageId: string;
  targetLanguage: string;
  signal?: AbortSignal;
};

export type ChatMessageTranslation = {
  messageId: string;
  originalContent: string;
  translatedContent: string;
  targetLanguage: string;
};

export type LegacySocketErrorPayload = {
  message: string;
  issues?: unknown;
};

export type NormalizedChatError = {
  event?: string;
  code?: string;
  message: string;
  issues?: unknown;
};
