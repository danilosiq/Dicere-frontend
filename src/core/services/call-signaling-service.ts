import type {
  CallJoinedPayload,
  CallReadyPayload,
  SocketEventErrorPayload,
  WaitingForParticipantPayload,
} from "@/core/@types/socket-events";

import { getSocket } from "./socket-service";

const JOIN_CALL_TIMEOUT_MS = 10_000;

type NotifyParticipantReadyParams = {
  roomId: string;
  participantId: string;
};

type SubscribeToParticipantReadyParams = {
  onWaitingForParticipant: (payload: WaitingForParticipantPayload) => void;
  onCallReady: (payload: CallReadyPayload) => void;
  onError: (error: ParticipantReadyRequestError) => void;
  onDisconnect: () => void;
};

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
let participantReadyEmissionKey: string | null = null;

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

function isWaitingForParticipantPayload(
  payload: unknown,
): payload is WaitingForParticipantPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<WaitingForParticipantPayload>;

  return (
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    candidate.readyParticipants === 1
  );
}

function isCallReadyPayload(payload: unknown): payload is CallReadyPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<CallReadyPayload>;

  return (
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    typeof candidate.initiatorParticipantId === "string" &&
    candidate.initiatorParticipantId.length > 0 &&
    typeof candidate.shouldCreateOffer === "boolean"
  );
}

function createParticipantReadyEmissionKey({
  roomId,
  participantId,
}: NotifyParticipantReadyParams) {
  const socket = getSocket();

  return `${socket.id}:${roomId}:${participantId}`;
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

export class ParticipantReadyRequestError extends Error {
  code: string;

  constructor({ code, message }: { code: string; message: string }) {
    super(message);
    this.name = "ParticipantReadyRequestError";
    this.code = code;
  }
}

export function notifyParticipantReady(params: NotifyParticipantReadyParams) {
  const socket = getSocket();

  if (!socket.connected || !socket.id) {
    throw new ParticipantReadyRequestError({
      code: "SOCKET_NOT_CONNECTED",
      message: "A conexão com a sala foi interrompida. Entre novamente.",
    });
  }

  const emissionKey = createParticipantReadyEmissionKey(params);

  if (participantReadyEmissionKey === emissionKey) {
    return false;
  }

  participantReadyEmissionKey = emissionKey;
  socket.emit("participant-ready");

  return true;
}

export function subscribeToParticipantReady({
  onWaitingForParticipant,
  onCallReady,
  onError,
  onDisconnect,
}: SubscribeToParticipantReadyParams) {
  const socket = getSocket();

  const handleWaitingForParticipant = (payload: unknown) => {
    if (!isWaitingForParticipantPayload(payload)) {
      onError(
        new ParticipantReadyRequestError({
          code: "INVALID_WAITING_FOR_PARTICIPANT_RESPONSE",
          message: "O servidor retornou um estado de espera inválido.",
        }),
      );
      return;
    }

    onWaitingForParticipant(payload);
  };

  const handleCallReady = (payload: unknown) => {
    if (!isCallReadyPayload(payload)) {
      onError(
        new ParticipantReadyRequestError({
          code: "INVALID_CALL_READY_RESPONSE",
          message: "O servidor retornou uma confirmação de chamada inválida.",
        }),
      );
      return;
    }

    onCallReady(payload);
  };

  const handleError = (payload: unknown) => {
    if (!payload || typeof payload !== "object") {
      return;
    }

    const candidate = payload as Partial<SocketEventErrorPayload>;

    if (candidate.event !== "participant-ready") {
      return;
    }

    if (
      typeof candidate.code !== "string" ||
      candidate.code.length === 0 ||
      typeof candidate.message !== "string" ||
      candidate.message.length === 0
    ) {
      onError(
        new ParticipantReadyRequestError({
          code: "INVALID_PARTICIPANT_READY_ERROR_RESPONSE",
          message: "O servidor retornou um erro de preparação inválido.",
        }),
      );
      return;
    }

    onError(
      new ParticipantReadyRequestError({
        code: candidate.code,
        message: candidate.message,
      }),
    );
  };

  const handleDisconnect = () => {
    participantReadyEmissionKey = null;
    onDisconnect();
  };

  socket.on("waiting-for-participant", handleWaitingForParticipant);
  socket.on("call-ready", handleCallReady);
  socket.on("error", handleError);
  socket.on("disconnect", handleDisconnect);

  return () => {
    socket.off("waiting-for-participant", handleWaitingForParticipant);
    socket.off("call-ready", handleCallReady);
    socket.off("error", handleError);
    socket.off("disconnect", handleDisconnect);
  };
}

export function resetParticipantReady(params?: NotifyParticipantReadyParams) {
  if (!params) {
    participantReadyEmissionKey = null;
    return;
  }

  if (
    participantReadyEmissionKey === createParticipantReadyEmissionKey(params)
  ) {
    participantReadyEmissionKey = null;
  }
}
