import axios from "axios";

import type {
  CreateRoomInput,
  CreateRoomResult,
  JoinRoomPayload,
  RoomJoinedPayload,
} from "@/core/@types/room";
import type { SocketEventErrorPayload } from "@/core/@types/socket-events";
import { api } from "@/core/services/api-service";
import { getSocket } from "@/core/services/socket-service";

const JOIN_ROOM_TIMEOUT_MS = 10_000;
const RECONNECT_RETRY_DELAY_MS = 250;
const RECONNECT_RETRY_ATTEMPTS = 3;

const JOIN_ROOM_ERROR_MESSAGES: Record<string, string> = {
  INVALID_ROOM_CODE: "Código da sala inválido.",
  ROOM_NOT_FOUND: "Sala não encontrada.",
  ROOM_FULL: "Esta sala já possui dois participantes.",
  INVALID_ROOM_PASSWORD: "Senha incorreta.",
  ROOM_EXPIRED: "Esta sala expirou.",
  ROOM_INACTIVE: "Esta sala não está mais ativa.",
  INVALID_NICKNAME: "Informe seu nome.",
  NICKNAME_ALREADY_IN_USE: "Este nome já está sendo usado na sala.",
  PARTICIPANT_NOT_LINKED_TO_ROOM: "Não foi possível retomar este participante.",
  PARTICIPANT_ALREADY_CONNECTED: "Este participante já está conectado.",
  INTERNAL_ERROR: "Não foi possível entrar na sala. Tente novamente.",
};

type CreateRoomResponse = {
  message: string;
  data: CreateRoomResult;
};

export class RoomAccessError extends Error {
  code: string;
  cause?: unknown;

  constructor({
    code,
    message,
    cause,
  }: {
    code: string;
    message: string;
    cause?: unknown;
  }) {
    super(message);
    this.name = "RoomAccessError";
    this.code = code;
    this.cause = cause;
  }
}

function normalizeCreateRoomError(cause: unknown) {
  if (axios.isAxiosError(cause)) {
    const message =
      typeof cause.response?.data?.message === "string"
        ? cause.response.data.message
        : "Não foi possível criar a sala. Tente novamente.";

    return new RoomAccessError({
      code:
        cause.response?.status === 400
          ? "INVALID_CREATE_ROOM_DATA"
          : "CREATE_ROOM_FAILED",
      message:
        cause.response?.status === 400
          ? "Confira os dados informados para criar a sala."
          : message,
      cause,
    });
  }

  return new RoomAccessError({
    code: "CREATE_ROOM_FAILED",
    message: "Não foi possível criar a sala. Tente novamente.",
    cause,
  });
}

export async function createRoom(input: CreateRoomInput) {
  try {
    const response = await api.post<CreateRoomResponse>("/room", input);
    return response.data.data;
  } catch (cause) {
    throw normalizeCreateRoomError(cause);
  }
}

function wait(delay: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, delay));
}

export function joinRoom(payload: JoinRoomPayload): Promise<RoomJoinedPayload> {
  const socket = getSocket();

  return new Promise((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      socket.off("room_joined", handleJoined);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("connect", emitJoinRoom);
      window.clearTimeout(timeoutId);
    };

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const handleJoined = (confirmation: RoomJoinedPayload) => {
      settle(() => resolve(confirmation));
    };

    const handleError = (error: SocketEventErrorPayload) => {
      if (error.event !== "join_room") return;

      settle(() => {
        reject(
          new RoomAccessError({
            code: error.code,
            message: JOIN_ROOM_ERROR_MESSAGES[error.code] ?? error.message,
          }),
        );
      });
    };

    const handleDisconnect = () => {
      settle(() => {
        reject(
          new RoomAccessError({
            code: "SOCKET_DISCONNECTED",
            message:
              "A conexão com o servidor foi interrompida. Tente novamente.",
          }),
        );
      });
    };

    const handleConnectError = (cause: Error) => {
      settle(() => {
        reject(
          new RoomAccessError({
            code: "SOCKET_CONNECTION_FAILED",
            message: "Não foi possível conectar ao servidor. Tente novamente.",
            cause,
          }),
        );
      });
    };

    const emitJoinRoom = () => socket.emit("join_room", payload);
    const timeoutId = window.setTimeout(() => {
      settle(() => {
        reject(
          new RoomAccessError({
            code: "JOIN_ROOM_TIMEOUT",
            message:
              "O servidor demorou para confirmar a entrada. Tente novamente.",
          }),
        );
      });
    }, JOIN_ROOM_TIMEOUT_MS);

    socket.on("room_joined", handleJoined);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      emitJoinRoom();
      return;
    }

    socket.once("connect", emitJoinRoom);
    socket.connect();
  });
}

export async function joinRoomWithReconnectRetry(payload: JoinRoomPayload) {
  for (let attempt = 0; attempt < RECONNECT_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await joinRoom(payload);
    } catch (cause) {
      const shouldRetry =
        cause instanceof RoomAccessError &&
        cause.code === "PARTICIPANT_ALREADY_CONNECTED" &&
        attempt < RECONNECT_RETRY_ATTEMPTS - 1;

      if (!shouldRetry) throw cause;
      await wait(RECONNECT_RETRY_DELAY_MS);
    }
  }

  throw new RoomAccessError({
    code: "JOIN_ROOM_FAILED",
    message: "Não foi possível entrar na sala. Tente novamente.",
  });
}
