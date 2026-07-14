import { z } from "zod";

export const createRoomSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da sala"),
  nickname: z.string().trim().min(1, "Informe seu nome"),
  password: z.string().min(6, "A senha deve possuir pelo menos 6 caracteres"),
});

export type CreateRoomSchemaType = z.infer<typeof createRoomSchema>;
