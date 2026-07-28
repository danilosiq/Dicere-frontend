import type {
  CallLeaveReason,
  CallLeftPayload,
  CallJoinedPayload,
  CallReadyPayload,
  ParticipantLeftCallPayload,
  RoomExpiredPayload,
  SocketEventErrorPayload,
  WaitingForParticipantPayload,
  WebRtcAnswerPayload,
  WebRtcAnswerReceivedPayload,
  WebRtcDescriptionSentPayload,
  WebRtcIceCandidatePayload,
  WebRtcIceCandidateReceivedPayload,
  WebRtcOfferPayload,
  WebRtcOfferReceivedPayload,
} from "@/core/@types/socket-events";

import { getSocket } from "./socket-service";
import {
  isWebRtcDescription,
  isWebRtcDescriptionReceivedPayload,
  isWebRtcIceCandidate,
  isWebRtcIceCandidateReceivedPayload,
} from "./webrtc-signaling-utils";

const JOIN_CALL_TIMEOUT_MS = 10_000;
const JOIN_CALL_RETRY_DELAY_MS = 300;
const JOIN_CALL_RETRY_ATTEMPTS = 4;

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
  cancel: () => void;
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

  let cancel = () => undefined;

  const promise = new Promise<CallJoinedPayload>((resolve, reject) => {
    let isSettled = false;
    let joinAttempt = 0;
    let retryTimeoutId: number | null = null;

    const cleanup = () => {
      window.clearTimeout(timeoutId);

      if (retryTimeoutId !== null) {
        window.clearTimeout(retryTimeoutId);
      }

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

      if (
        payload.code === "PARTICIPANT_ALREADY_IN_CALL" &&
        joinAttempt < JOIN_CALL_RETRY_ATTEMPTS
      ) {
        if (retryTimeoutId !== null) {
          return;
        }

        retryTimeoutId = window.setTimeout(() => {
          retryTimeoutId = null;
          emitJoinCall();
        }, JOIN_CALL_RETRY_DELAY_MS);
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

    const emitJoinCall = () => {
      joinAttempt += 1;
      socket.emit("join-call");
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
    cancel = () => {
      settle(() => {
        reject(
          new JoinCallRequestError({
            code: "JOIN_CALL_CANCELLED",
            message: "A entrada na chamada foi cancelada.",
          }),
        );
      });
    };
    emitJoinCall();
  });

  pendingJoinCall = { socketId, promise, cancel };

  return promise;
}

export function resetJoinCall() {
  pendingJoinCall?.cancel();
  pendingJoinCall = null;
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

type SubscribeToWebRtcSignalingParams = {
  onOffer: (payload: WebRtcOfferReceivedPayload) => void;
  onOfferSent?: (payload: WebRtcDescriptionSentPayload) => void;
  onAnswer: (payload: WebRtcAnswerReceivedPayload) => void;
  onAnswerSent?: (payload: WebRtcDescriptionSentPayload) => void;
  onIceCandidate: (payload: WebRtcIceCandidateReceivedPayload) => void;
  onCallLeft?: (payload: CallLeftPayload) => void;
  onParticipantLeft: (payload: ParticipantLeftCallPayload) => void;
  onLocalParticipantRemoved: () => void;
  onRoomExpired: (payload: RoomExpiredPayload) => void;
  onError: (error: WebRtcSignalingError) => void;
  onDisconnect: () => void;
};

const WEBRTC_SIGNALING_EVENTS = new Set([
  "webrtc-offer",
  "webrtc-answer",
  "webrtc-ice-candidate",
  "leave-call",
]);

export class WebRtcSignalingError extends Error {
  code: string;
  event: string;

  constructor({
    code,
    event,
    message,
  }: {
    code: string;
    event: string;
    message: string;
  }) {
    super(message);
    this.name = "WebRtcSignalingError";
    this.code = code;
    this.event = event;
  }
}

function assertConnectedSocket(event: string) {
  const socket = getSocket();

  if (!socket.connected || !socket.id) {
    throw new WebRtcSignalingError({
      code: "SOCKET_NOT_CONNECTED",
      event,
      message: "A conexão com a sala foi interrompida. Entre novamente.",
    });
  }

  return socket;
}

export function sendWebRtcOffer(payload: WebRtcOfferPayload) {
  if (!isWebRtcDescription(payload.description, "offer")) {
    throw new WebRtcSignalingError({
      code: "INVALID_WEBRTC_OFFER",
      event: "webrtc-offer",
      message: "Não foi possível enviar uma oferta WebRTC válida.",
    });
  }

  assertConnectedSocket("webrtc-offer").emit("webrtc-offer", payload);
}

export function sendWebRtcAnswer(payload: WebRtcAnswerPayload) {
  if (!isWebRtcDescription(payload.description, "answer")) {
    throw new WebRtcSignalingError({
      code: "INVALID_WEBRTC_ANSWER",
      event: "webrtc-answer",
      message: "Não foi possível enviar uma resposta WebRTC válida.",
    });
  }

  assertConnectedSocket("webrtc-answer").emit("webrtc-answer", payload);
}

export function sendWebRtcIceCandidate(payload: WebRtcIceCandidatePayload) {
  if (!isWebRtcIceCandidate(payload.candidate)) {
    throw new WebRtcSignalingError({
      code: "INVALID_WEBRTC_ICE_CANDIDATE",
      event: "webrtc-ice-candidate",
      message: "Não foi possível enviar um candidato de rede válido.",
    });
  }

  assertConnectedSocket("webrtc-ice-candidate").emit(
    "webrtc-ice-candidate",
    payload,
  );
}

export function leaveCall({
  reason = "USER_LEFT",
}: {
  reason?: CallLeaveReason;
} = {}) {
  assertConnectedSocket("leave-call").emit("leave-call", { reason });
}

function isDescriptionSentPayload(
  payload: unknown,
): payload is WebRtcDescriptionSentPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<WebRtcDescriptionSentPayload>;

  return (
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    typeof candidate.toParticipantId === "string" &&
    candidate.toParticipantId.length > 0
  );
}

function isCallLeaveReason(value: unknown): value is CallLeaveReason {
  return value === "USER_LEFT" || value === "CONNECTION_CLOSED";
}

function isCallTerminationReason(
  value: unknown,
): value is ParticipantLeftCallPayload["reason"] {
  return (
    isCallLeaveReason(value) ||
    value === "PARTICIPANT_REMOVED" ||
    value === "ROOM_CLOSED" ||
    value === "ROOM_EXPIRED"
  );
}

function isCallLeftPayload(payload: unknown): payload is CallLeftPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<CallLeftPayload>;

  return (
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    typeof candidate.participantId === "string" &&
    candidate.participantId.length > 0 &&
    isCallLeaveReason(candidate.reason)
  );
}

function isParticipantLeftCallPayload(
  payload: unknown,
): payload is ParticipantLeftCallPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<ParticipantLeftCallPayload>;

  return (
    typeof candidate.participantId === "string" &&
    candidate.participantId.length > 0 &&
    isCallTerminationReason(candidate.reason)
  );
}

function isRoomExpiredPayload(payload: unknown): payload is RoomExpiredPayload {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const candidate = payload as Partial<RoomExpiredPayload>;

  return (
    typeof candidate.roomId === "string" &&
    candidate.roomId.length > 0 &&
    candidate.status === "EXPIRED" &&
    (candidate.reason === undefined || typeof candidate.reason === "string")
  );
}

export function subscribeToWebRtcSignaling({
  onOffer,
  onOfferSent,
  onAnswer,
  onAnswerSent,
  onIceCandidate,
  onCallLeft,
  onParticipantLeft,
  onLocalParticipantRemoved,
  onRoomExpired,
  onError,
  onDisconnect,
}: SubscribeToWebRtcSignalingParams) {
  const socket = getSocket();

  const reportInvalidPayload = (event: string) => {
    onError(
      new WebRtcSignalingError({
        code: "INVALID_SIGNALING_RESPONSE",
        event,
        message: "O servidor retornou dados de negociação inválidos.",
      }),
    );
  };

  const handleOffer = (payload: unknown) => {
    if (!isWebRtcDescriptionReceivedPayload(payload, "offer")) {
      reportInvalidPayload("webrtc-offer");
      return;
    }

    onOffer(payload as WebRtcOfferReceivedPayload);
  };

  const handleOfferSent = (payload: unknown) => {
    if (!isDescriptionSentPayload(payload)) {
      reportInvalidPayload("webrtc-offer-sent");
      return;
    }

    onOfferSent?.(payload);
  };

  const handleAnswer = (payload: unknown) => {
    if (!isWebRtcDescriptionReceivedPayload(payload, "answer")) {
      reportInvalidPayload("webrtc-answer");
      return;
    }

    onAnswer(payload as WebRtcAnswerReceivedPayload);
  };

  const handleAnswerSent = (payload: unknown) => {
    if (!isDescriptionSentPayload(payload)) {
      reportInvalidPayload("webrtc-answer-sent");
      return;
    }

    onAnswerSent?.(payload);
  };

  const handleIceCandidate = (payload: unknown) => {
    if (!isWebRtcIceCandidateReceivedPayload(payload)) {
      reportInvalidPayload("webrtc-ice-candidate");
      return;
    }

    onIceCandidate(payload as WebRtcIceCandidateReceivedPayload);
  };

  const handleCallLeft = (payload: unknown) => {
    if (!isCallLeftPayload(payload)) {
      reportInvalidPayload("call-left");
      return;
    }

    onCallLeft?.(payload);
  };

  const handleParticipantLeft = (payload: unknown) => {
    if (!isParticipantLeftCallPayload(payload)) {
      reportInvalidPayload("participant-left-call");
      return;
    }

    onParticipantLeft(payload);
  };

  const handleLocalParticipantRemoved = () => {
    onLocalParticipantRemoved();
  };

  const handleRoomExpired = (payload: unknown) => {
    if (!isRoomExpiredPayload(payload)) {
      reportInvalidPayload("room_expired");
      return;
    }

    onRoomExpired(payload);
  };

  const handleError = (payload: SocketEventErrorPayload) => {
    if (!WEBRTC_SIGNALING_EVENTS.has(payload.event)) {
      return;
    }

    onError(
      new WebRtcSignalingError({
        code: payload.code,
        event: payload.event,
        message: payload.message,
      }),
    );
  };

  socket.on("webrtc-offer", handleOffer);
  socket.on("webrtc-offer-sent", handleOfferSent);
  socket.on("webrtc-answer", handleAnswer);
  socket.on("webrtc-answer-sent", handleAnswerSent);
  socket.on("webrtc-ice-candidate", handleIceCandidate);
  socket.on("call-left", handleCallLeft);
  socket.on("participant-left-call", handleParticipantLeft);
  socket.on("participant_removed_success", handleLocalParticipantRemoved);
  socket.on("room_expired", handleRoomExpired);
  socket.on("error", handleError);
  socket.on("disconnect", onDisconnect);

  return () => {
    socket.off("webrtc-offer", handleOffer);
    socket.off("webrtc-offer-sent", handleOfferSent);
    socket.off("webrtc-answer", handleAnswer);
    socket.off("webrtc-answer-sent", handleAnswerSent);
    socket.off("webrtc-ice-candidate", handleIceCandidate);
    socket.off("call-left", handleCallLeft);
    socket.off("participant-left-call", handleParticipantLeft);
    socket.off("participant_removed_success", handleLocalParticipantRemoved);
    socket.off("room_expired", handleRoomExpired);
    socket.off("error", handleError);
    socket.off("disconnect", onDisconnect);
  };
}

export function resetCallSignaling() {
  resetJoinCall();
  resetParticipantReady();
}
