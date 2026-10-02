import { z } from "zod";

import { COUNTRY_LIST } from "@/core/components/selector-country/countryList";

export const createRoomSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Informe o título da sala")
    .max(50, "O título deve possuir no máximo 50 caracteres"),
  nickname: z.string().trim().min(1, "Informe seu nome"),
  password: z.string().min(6, "A senha deve possuir pelo menos 6 caracteres"),
  targetLanguage: z.enum(
    COUNTRY_LIST.map(({ label }) => label),
    {
      error: "Selecione o idioma em que deseja receber as traduções",
    },
  ),
  spokenLanguage: z.enum(
    COUNTRY_LIST.map(({ label }) => label),
    { error: "Selecione o idioma que você irá falar na chamada" },
  ),
});

export type CreateRoomSchemaType = z.infer<typeof createRoomSchema>;
