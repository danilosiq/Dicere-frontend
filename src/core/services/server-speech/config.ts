import type { DeepLTargetLanguage } from "@/core/components";
import { toSpeechRecognitionLocale } from "@/core/utils/speech-recognition-language";
import { isServerSpeechLocale } from "./languages";

const roomIdPattern =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function isServerSpeechEnabled(
  roomId?: string,
  language: DeepLTargetLanguage = "PT-BR",
) {
  if (
    !roomId ||
    !roomIdPattern.test(roomId) ||
    !isServerSpeechLocale(toSpeechRecognitionLocale(language))
  )
    return false;
  if (!(process.env.NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS ?? "").trim())
    return process.env.NEXT_PUBLIC_SPEECH_SERVER_ENABLED === "true";
  const rooms = (process.env.NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS ?? "")
    .split(",")
    .map((value) => value.trim());
  // This selects the UI only. The backend independently authorizes the room,
  // participant and pilot; public room ids are never credentials.
  return (
    rooms.length <= 10 &&
    rooms.every((value) => roomIdPattern.test(value)) &&
    rooms.includes(roomId)
  );
}
