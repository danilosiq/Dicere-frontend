import { z } from "zod";

export const joinRoomSchema = z.object({
  roomCode: z.string().trim().min(1, "Informe o código da sala"),
  name: z.string().trim().min(1, "Informe seu nome"),
  password: z.string().min(1, "Informe a senha"),
});

export type JoinRoomSchemaType = z.infer<typeof joinRoomSchema>;
