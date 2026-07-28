"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CallReadyPayload,
  WaitingForParticipantPayload,
} from "@/core/@types/socket-events";
import {
  notifyParticipantReady,
  ParticipantReadyRequestError,
  resetParticipantReady,
  subscribeToParticipantReady,
} from "@/core/services/call-signaling-service";
import { useCallStore } from "@/core/store/call-store";

type UseParticipantReadyParams = {
  peerConnection: RTCPeerConnection | null;
};

const PARTICIPANT_READY_TIMEOUT_MS = 10_000;

export type ParticipantReadyError = {
  code: string;
  message: string;
  cause: unknown;
};

function normalizeParticipantReadyError(cause: unknown): ParticipantReadyError {
  if (cause instanceof ParticipantReadyRequestError) {
    return {
      code: cause.code,
      message: cause.message,
      cause,
    };
  }

  return {
    code: "UNKNOWN_PARTICIPANT_READY_ERROR",
    message: "Não foi possível preparar a chamada. Tente novamente.",
    cause,
  };
}

function hasReadyLocalMedia(stream: MediaStream | null) {
  if (!stream) {
    return false;
  }

  const hasLiveAudio = stream
    .getAudioTracks()
    .some((track) => track.readyState === "live");
  const hasLiveVideo = stream
    .getVideoTracks()
    .some((track) => track.readyState === "live");

  return hasLiveAudio && hasLiveVideo;
}

function isPeerConnectionReady(
  peerConnection: RTCPeerConnection | null,
  stream: MediaStream | null,
) {
  if (
    !peerConnection ||
    peerConnection.signalingState === "closed" ||
    !stream
  ) {
    return false;
  }

  const liveTracks = stream
    .getTracks()
    .filter((track) => track.readyState === "live");
  const senderTracks = new Set(
    peerConnection
      .getSenders()
      .map((sender) => sender.track)
      .filter((track): track is MediaStreamTrack => track !== null),
  );

  return (
    liveTracks.length > 0 &&
    liveTracks.every((track) => senderTracks.has(track))
  );
}

export function useParticipantReady({
  peerConnection,
}: UseParticipantReadyParams) {
  const localStream = useCallStore((state) => state.localStream);
  const joinedCall = useCallStore((state) => state.joinedCall);
  const waitingForParticipant = useCallStore(
    (state) => state.waitingForParticipant,
  );
  const callReady = useCallStore((state) => state.callReady);
  const setWaitingForParticipant = useCallStore(
    (state) => state.setWaitingForParticipant,
  );
  const setCallReady = useCallStore((state) => state.setCallReady);
  const clearParticipantReadiness = useCallStore(
    (state) => state.clearParticipantReadiness,
  );
  const [error, setError] = useState<ParticipantReadyError | null>(null);
  const previousCallRef = useRef<{
    roomId: string;
    participantId: string;
  } | null>(null);

  useEffect(() => {
    return subscribeToParticipantReady({
      onWaitingForParticipant: (payload: WaitingForParticipantPayload) => {
        const currentState = useCallStore.getState();

        if (
          currentState.joinedCall?.roomId !== payload.roomId ||
          currentState.callReady !== null
        ) {
          return;
        }

        setWaitingForParticipant(payload);
        setError(null);
      },
      onCallReady: (payload: CallReadyPayload) => {
        const currentState = useCallStore.getState();

        if (
          currentState.joinedCall?.roomId !== payload.roomId ||
          currentState.callReady !== null
        ) {
          return;
        }

        const isLocalInitiator =
          currentState.joinedCall.participantId ===
          payload.initiatorParticipantId;

        if (payload.shouldCreateOffer !== isLocalInitiator) {
          clearParticipantReadiness();
          setError(
            normalizeParticipantReadyError(
              new ParticipantReadyRequestError({
                code: "INVALID_CALL_READY_INITIATOR",
                message:
                  "O servidor retornou uma definição de iniciador inválida.",
              }),
            ),
          );
          return;
        }

        setCallReady(payload);
        setError(null);
      },
      onError: (cause) => {
        clearParticipantReadiness();
        setError(normalizeParticipantReadyError(cause));
      },
      onDisconnect: () => {
        clearParticipantReadiness();
        setError(
          normalizeParticipantReadyError(
            new ParticipantReadyRequestError({
              code: "SOCKET_DISCONNECTED",
              message:
                "A conexão com a sala foi interrompida. Entre novamente.",
            }),
          ),
        );
      },
    });
  }, [clearParticipantReadiness, setCallReady, setWaitingForParticipant]);

  useEffect(() => {
    const previousCall = previousCallRef.current;

    if (
      previousCall &&
      (!joinedCall ||
        previousCall.roomId !== joinedCall.roomId ||
        previousCall.participantId !== joinedCall.participantId)
    ) {
      resetParticipantReady(previousCall);
    }

    previousCallRef.current = joinedCall
      ? {
          roomId: joinedCall.roomId,
          participantId: joinedCall.participantId,
        }
      : null;
  }, [joinedCall]);

  useEffect(() => {
    if (
      !joinedCall ||
      !hasReadyLocalMedia(localStream) ||
      !isPeerConnectionReady(peerConnection, localStream) ||
      waitingForParticipant ||
      callReady ||
      error
    ) {
      return;
    }

    let isCancelled = false;
    let timeoutId: number | null = null;

    queueMicrotask(() => {
      if (isCancelled) {
        return;
      }

      try {
        notifyParticipantReady({
          roomId: joinedCall.roomId,
          participantId: joinedCall.participantId,
        });

        timeoutId = window.setTimeout(() => {
          setError(
            normalizeParticipantReadyError(
              new ParticipantReadyRequestError({
                code: "PARTICIPANT_READY_TIMEOUT",
                message:
                  "O servidor demorou para confirmar a preparação da chamada.",
              }),
            ),
          );
        }, PARTICIPANT_READY_TIMEOUT_MS);
      } catch (cause: unknown) {
        setError(normalizeParticipantReadyError(cause));
      }
    });

    return () => {
      isCancelled = true;

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    callReady,
    error,
    joinedCall,
    localStream,
    peerConnection,
    waitingForParticipant,
  ]);

  const retryParticipantReady = useCallback(() => {
    if (!joinedCall) {
      return;
    }

    resetParticipantReady({
      roomId: joinedCall.roomId,
      participantId: joinedCall.participantId,
    });
    setError(null);
  }, [joinedCall]);

  const isWaitingForParticipant = waitingForParticipant !== null;
  const isCallReady = callReady !== null;
  const shouldCreateOffer = callReady?.shouldCreateOffer ?? false;
  const isInitiator =
    joinedCall !== null &&
    callReady?.initiatorParticipantId === joinedCall.participantId;
  const isPrepared =
    joinedCall !== null &&
    hasReadyLocalMedia(localStream) &&
    isPeerConnectionReady(peerConnection, localStream);
  const isNotifying =
    isPrepared && !isWaitingForParticipant && !isCallReady && error === null;

  return {
    waitingForParticipant,
    callReady,
    isNotifying,
    isWaitingForParticipant,
    isCallReady,
    isInitiator,
    shouldCreateOffer,
    isError: error !== null,
    error,
    errorMessage: error?.message ?? null,
    retryParticipantReady,
  };
}
