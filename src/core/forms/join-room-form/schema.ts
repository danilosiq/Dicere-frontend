import { z } from "zod";
import { ROOM_CODE_PATTERN } from "@/core/@types/room";
import { DEEPL_TARGET_LANGUAGES } from "@/core/components/selector-country/countryList";

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .min(1, "Informe o código da sala")
    .regex(ROOM_CODE_PATTERN, "Código da sala inválido"),
  name: z.string().trim().min(1, "Informe seu nome"),
  password: z.string().min(1, "Informe a senha"),
  targetLanguage: z.enum(DEEPL_TARGET_LANGUAGES, {
    error: "Selecione o idioma em que deseja receber as traduções",
  }),
});

export type JoinRoomSchemaType = z.infer<typeof joinRoomSchema>;
