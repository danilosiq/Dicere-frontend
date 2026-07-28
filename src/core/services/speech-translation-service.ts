import type {
  SocketEventErrorPayload,
  TranslateSpeechPayload,
  VoiceTranslationReceivedPayload,
} from "@/core/@types/socket-events";
import { getSocket } from "@/core/services/socket-service";

export const MAX_SPEECH_TRANSLATION_CHARACTERS = 250;

export class SpeechTranslationConnectionError extends Error {
  constructor() {
    super("A conexão com a tradução foi interrompida.");
    this.name = "SpeechTranslationConnectionError";
  }
}

function splitLongWord(word: string) {
  const chunks: string[] = [];

  for (
    let start = 0;
    start < word.length;
    start += MAX_SPEECH_TRANSLATION_CHARACTERS
  ) {
    chunks.push(word.slice(start, start + MAX_SPEECH_TRANSLATION_CHARACTERS));
  }

  return chunks;
}

export function splitSpeechText(text: string) {
  const normalizedText = text.trim().replace(/\s+/g, " ");
  if (!normalizedText) return [];

  const chunks: string[] = [];
  let currentChunk = "";

  for (const word of normalizedText.split(" ")) {
    if (word.length > MAX_SPEECH_TRANSLATION_CHARACTERS) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      chunks.push(...splitLongWord(word));
      continue;
    }

    const candidate = currentChunk ? `${currentChunk} ${word}` : word;

    if (candidate.length <= MAX_SPEECH_TRANSLATION_CHARACTERS) {
      currentChunk = candidate;
      continue;
    }

    chunks.push(currentChunk);
    currentChunk = word;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function sendSpeechForTranslation(payload: TranslateSpeechPayload) {
  const socket = getSocket();

  if (!socket.connected) {
    throw new SpeechTranslationConnectionError();
  }

  const chunks = splitSpeechText(payload.text);

  for (const text of chunks) {
    socket.emit("translate_speech", {
      roomId: payload.roomId.trim(),
      text,
    });
  }

  return chunks;
}

function isVoiceTranslationPayload(
  payload: unknown,
): payload is VoiceTranslationReceivedPayload {
  if (!payload || typeof payload !== "object") return false;

  const candidate = payload as Partial<VoiceTranslationReceivedPayload>;

  return (
    typeof candidate.roomId === "string" &&
    typeof candidate.fromParticipantId === "string" &&
    typeof candidate.fromParticipantName === "string" &&
    typeof candidate.originalText === "string" &&
    typeof candidate.translatedText === "string" &&
    typeof candidate.targetLanguage === "string"
  );
}

type SpeechTranslationSubscription = {
  onTranslation: (payload: VoiceTranslationReceivedPayload) => void;
  onError: (message: string) => void;
};

export function subscribeToSpeechTranslations({
  onTranslation,
  onError,
}: SpeechTranslationSubscription) {
  const socket = getSocket();

  const handleTranslation = (payload: VoiceTranslationReceivedPayload) => {
    if (!isVoiceTranslationPayload(payload)) {
      onError("O servidor retornou uma legenda inválida.");
      return;
    }

    onTranslation(payload);
  };

  const handleError = (payload: SocketEventErrorPayload) => {
    if (!payload || payload.event !== "translate_speech") return;
    onError(payload.message || "Não foi possível traduzir este trecho.");
  };

  socket.on("voice_translation_received", handleTranslation);
  socket.on("error", handleError);

  return () => {
    socket.off("voice_translation_received", handleTranslation);
    socket.off("error", handleError);
  };
}
