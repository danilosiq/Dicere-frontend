import type { ChatMessage } from "@/core/@types/chat";

function compareMessages(left: ChatMessage, right: ChatMessage) {
  const leftTimestamp = Date.parse(left.createdAt);
  const rightTimestamp = Date.parse(right.createdAt);
  const safeLeftTimestamp = Number.isNaN(leftTimestamp)
    ? Number.MAX_SAFE_INTEGER
    : leftTimestamp;
  const safeRightTimestamp = Number.isNaN(rightTimestamp)
    ? Number.MAX_SAFE_INTEGER
    : rightTimestamp;

  if (safeLeftTimestamp !== safeRightTimestamp) {
    return safeLeftTimestamp - safeRightTimestamp;
  }

  return left.id.localeCompare(right.id);
}

export function mergeChatMessages(
  currentMessages: ChatMessage[],
  incomingMessages: ChatMessage[],
) {
  const messagesById = new Map(
    currentMessages.map((message) => [message.id, message]),
  );

  for (const message of incomingMessages) {
    messagesById.set(message.id, message);
  }

  return Array.from(messagesById.values()).sort(compareMessages);
}
