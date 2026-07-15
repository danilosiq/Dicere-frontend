import type {
  CallJoinedPayload,
  SocketEventErrorPayload,
} from "@/core/@types/socket-events";

import { getSocket } from "./socket-service";

const JOIN_CALL_TIMEOUT_MS = 10_000;

type PendingJoinCall = {
  socketId: string;
  promise: Promise<CallJoinedPayload>;
};

type ConfirmedJoinCall = {
  socketId: string;
  payload: CallJoinedPayload;
};

export class JoinCallRequestError extends Error {
  code: string;

  constructor({ code, message }: { code: string; message: string }) {
    super(message);
    this.name = "JoinCallRequestError";
    this.code = code;
  }
}

let pendingJoinCall: PendingJoinCall | null = null;
let confirmedJoinCall: ConfirmedJoinCall | null = null;

function isCallJoinedPayload(payload: unknown): payload is CallJoinedPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<CallJoinedPayload>;

  return (
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    typeof candidate.participantId === "string" &&
    candidate.participantId.length > 0 &&
    typeof candidate.participantCount === "number" &&
    Number.isInteger(candidate.participantCount) &&
    candidate.participantCount >= 1 &&
    candidate.participantCount <= 2
  );
}

export function joinCall() {
  const socket = getSocket();
  const socketId = socket.id;

  if (!socket.connected || !socketId) {
    return Promise.reject(
      new JoinCallRequestError({
        code: "SOCKET_NOT_CONNECTED",
        message: "A conexão com a sala foi interrompida. Entre novamente.",
      }),
    );
  }

  if (confirmedJoinCall?.socketId === socketId) {
    return Promise.resolve(confirmedJoinCall.payload);
  }

  if (pendingJoinCall?.socketId === socketId) {
    return pendingJoinCall.promise;
  }

  confirmedJoinCall = null;

  const promise = new Promise<CallJoinedPayload>((resolve, reject) => {
    let isSettled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      socket.off("call-joined", handleCallJoined);
      socket.off("error", handleError);
      socket.off("disconnect", handleDisconnect);

      if (pendingJoinCall?.promise === promise) {
        pendingJoinCall = null;
      }
    };

    const settle = (callback: () => void) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();
      callback();
    };

    const handleCallJoined = (payload: CallJoinedPayload) => {
      if (!isCallJoinedPayload(payload)) {
        settle(() => {
          reject(
            new JoinCallRequestError({
              code: "INVALID_CALL_JOINED_RESPONSE",
              message:
                "O servidor retornou uma confirmação de chamada inválida.",
            }),
          );
        });
        return;
      }

      confirmedJoinCall = { socketId, payload };
      settle(() => resolve(payload));
    };

    const handleError = (payload: SocketEventErrorPayload) => {
      if (payload.event !== "join-call") {
        return;
      }

      settle(() => {
        reject(
          new JoinCallRequestError({
            code: payload.code,
            message: payload.message,
          }),
        );
      });
    };

    const handleDisconnect = () => {
      confirmedJoinCall = null;
      settle(() => {
        reject(
          new JoinCallRequestError({
            code: "SOCKET_DISCONNECTED",
            message: "A conexão com a sala foi interrompida. Entre novamente.",
          }),
        );
      });
    };

    const timeoutId = window.setTimeout(() => {
      settle(() => {
        reject(
          new JoinCallRequestError({
            code: "JOIN_CALL_TIMEOUT",
            message: "O servidor demorou para confirmar a entrada na chamada.",
          }),
        );
      });
    }, JOIN_CALL_TIMEOUT_MS);

    socket.on("call-joined", handleCallJoined);
    socket.on("error", handleError);
    socket.on("disconnect", handleDisconnect);
    socket.emit("join-call");
  });

  pendingJoinCall = { socketId, promise };

  return promise;
}

export function resetJoinCall() {
  confirmedJoinCall = null;
}
