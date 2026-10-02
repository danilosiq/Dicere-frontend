import { z } from "zod";
import type { DeepLTargetLanguage } from "@/core/components";
import { COUNTRY_LIST } from "@/core/components/selector-country/countryList";
import { getSocket } from "./socket-service";

const language = z.enum(COUNTRY_LIST.map(({ label }) => label));
const confirmation = z
  .object({
    result: z.literal("ok"),
    roomId: z.uuid(),
    participantId: z.uuid(),
    targetLanguage: language,
  })
  .strict();

export async function setTranslationLanguage(
  targetLanguage: DeepLTargetLanguage,
) {
  const socket = getSocket();
  if (!socket.connected)
    throw new Error("A conexão com a sala foi interrompida.");
  const selected = language.parse(targetLanguage);
  let response: unknown;
  try {
    response = await socket
      .timeout(5000)
      .emitWithAck("set_translation_language", { targetLanguage: selected });
  } catch {
    throw new Error(
      "Não foi possível confirmar o idioma. Tente selecionar novamente.",
    );
  }
  const parsed = confirmation.safeParse(response);
  if (!parsed.success || parsed.data.targetLanguage !== selected)
    throw new Error("Não foi possível alterar o idioma das traduções.");
  return parsed.data;
}
