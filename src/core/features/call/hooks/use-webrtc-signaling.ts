"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type {
  CallLeftPayload,
  ParticipantLeftCallPayload,
  WebRtcAnswerReceivedPayload,
  WebRtcIceCandidate,
  WebRtcIceCandidateReceivedPayload,
  WebRtcOfferReceivedPayload,
} from "@/core/@types/socket-events";
import {
  sendWebRtcAnswer,
  sendWebRtcIceCandidate,
  sendWebRtcOffer,
  subscribeToWebRtcSignaling,
  WebRtcSignalingError,
} from "@/core/services/call-signaling-service";
import {
  canApplyAnswer,
  canApplyOffer,
  canCreateOffer,
  shouldQueueIceCandidate,
} from "@/core/services/webrtc-signaling-utils";
import { useCallStore } from "@/core/store/call-store";

export type WebRtcNegotiationStatus =
  | "idle"
  | "creating-offer"
  | "waiting-for-answer"
  | "answering"
  | "negotiated"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

export type WebRtcSignalingHookError = {
  code: string;
  event: string;
  message: string;
  cause: unknown;
};

export type CallTermination =
  | { type: "call-left"; payload: CallLeftPayload }
  | { type: "participant-left"; payload: ParticipantLeftCallPayload }
  | { type: "socket-disconnected" };

type UseWebRtcSignalingParams = {
  peerConnection: RTCPeerConnection | null;
  onCallTerminated?: (termination: CallTermination) => void;
};

function normalizeSignalingError(cause: unknown): WebRtcSignalingHookError {
  if (cause instanceof WebRtcSignalingError) {
    return {
      code: cause.code,
      event: cause.event,
      message: cause.message,
      cause,
    };
  }

  return {
    code: "WEBRTC_NEGOTIATION_FAILED",
    event: "webrtc",
    message: "Não foi possível concluir a conexão da chamada.",
    cause,
  };
}

function toIceCandidatePayload(
  candidate: RTCIceCandidate | null,
): WebRtcIceCandidate {
  if (!candidate) {
    return {
      candidate: "",
      sdpMid: null,
      sdpMLineIndex: null,
      usernameFragment: null,
    };
  }

  const serializedCandidate = candidate.toJSON();

  return {
    candidate: serializedCandidate.candidate ?? "",
    sdpMid: serializedCandidate.sdpMid ?? null,
    sdpMLineIndex: serializedCandidate.sdpMLineIndex ?? null,
    usernameFragment: serializedCandidate.usernameFragment ?? null,
  };
}

export function useWebRtcSignaling({
  peerConnection,
  onCallTerminated,
}: UseWebRtcSignalingParams) {
  const joinedCall = useCallStore((state) => state.joinedCall);
  const callReady = useCallStore((state) => state.callReady);
  const connectionState = useCallStore((state) => state.connectionState);
  const [status, setStatus] = useState<WebRtcNegotiationStatus>("idle");
  const [error, setError] = useState<WebRtcSignalingHookError | null>(null);
  const peerConnectionRef = useRef(peerConnection);
  const joinedCallRef = useRef(joinedCall);
  const callReadyRef = useRef(callReady);
  const onCallTerminatedRef = useRef(onCallTerminated);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const pendingOfferRef = useRef<WebRtcOfferReceivedPayload | null>(null);
  const pendingAnswerRef = useRef<WebRtcAnswerReceivedPayload | null>(null);
  const processedOfferSdpRef = useRef<string | null>(null);
  const processedAnswerSdpRef = useRef<string | null>(null);
  const offerPeerRef = useRef<RTCPeerConnection | null>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    peerConnectionRef.current = peerConnection;
    pendingCandidatesRef.current = [];
    processedOfferSdpRef.current = null;
    processedAnswerSdpRef.current = null;
    offerPeerRef.current = null;
  }, [peerConnection]);

  useEffect(() => {
    joinedCallRef.current = joinedCall;
  }, [joinedCall]);

  useEffect(() => {
    callReadyRef.current = callReady;
  }, [callReady]);

  useEffect(() => {
    onCallTerminatedRef.current = onCallTerminated;
  }, [onCallTerminated]);

  const reportError = useCallback((cause: unknown) => {
    setError(normalizeSignalingError(cause));
  }, []);

  const enqueueOperation = useCallback(
    (operation: () => Promise<void>) => {
      const nextOperation = operationQueueRef.current
        .then(operation)
        .catch((cause: unknown) => {
          reportError(cause);
        });

      operationQueueRef.current = nextOperation;
      return nextOperation;
    },
    [reportError],
  );

  const assertRemoteParticipant = useCallback((fromParticipantId: string) => {
    const currentCall = joinedCallRef.current;

    if (!currentCall || currentCall.participantId === fromParticipantId) {
      throw new WebRtcSignalingError({
        code: "INVALID_SIGNALING_PARTICIPANT",
        event: "webrtc",
        message: "A negociação foi recebida de um participante inválido.",
      });
    }
  }, []);

  const flushPendingCandidates = useCallback(
    async (currentPeerConnection: RTCPeerConnection) => {
      const pendingCandidates = pendingCandidatesRef.current;
      pendingCandidatesRef.current = [];

      for (const candidate of pendingCandidates) {
        await currentPeerConnection.addIceCandidate(candidate);
      }
    },
    [],
  );

  const processOffer = useCallback(
    (payload: WebRtcOfferReceivedPayload) => {
      const currentPeerConnection = peerConnectionRef.current;
      const currentReadyState = callReadyRef.current;

      if (!currentPeerConnection || !currentReadyState) {
        pendingOfferRef.current = payload;
        return Promise.resolve();
      }

      return enqueueOperation(async () => {
        assertRemoteParticipant(payload.fromParticipantId);

        if (currentReadyState.shouldCreateOffer) {
          throw new WebRtcSignalingError({
            code: "UNEXPECTED_WEBRTC_OFFER",
            event: "webrtc-offer",
            message: "O iniciador recebeu uma oferta WebRTC inesperada.",
          });
        }

        if (processedOfferSdpRef.current === payload.description.sdp) {
          return;
        }

        if (
          !canApplyOffer({
            signalingState: currentPeerConnection.signalingState,
            hasRemoteDescription:
              currentPeerConnection.remoteDescription !== null,
          })
        ) {
          throw new WebRtcSignalingError({
            code: "INVALID_STATE_FOR_WEBRTC_OFFER",
            event: "webrtc-offer",
            message: "A conexão não está pronta para receber uma nova oferta.",
          });
        }

        setStatus("answering");
        await currentPeerConnection.setRemoteDescription(payload.description);
        processedOfferSdpRef.current = payload.description.sdp;
        await flushPendingCandidates(currentPeerConnection);

        const answer = await currentPeerConnection.createAnswer();
        await currentPeerConnection.setLocalDescription(answer);

        if (!answer.sdp) {
          throw new WebRtcSignalingError({
            code: "EMPTY_WEBRTC_ANSWER",
            event: "webrtc-answer",
            message: "O navegador não conseguiu criar a resposta da chamada.",
          });
        }

        sendWebRtcAnswer({
          description: { type: "answer", sdp: answer.sdp },
        });
        setStatus("negotiated");
        setError(null);
      });
    },
    [assertRemoteParticipant, enqueueOperation, flushPendingCandidates],
  );

  const processAnswer = useCallback(
    (payload: WebRtcAnswerReceivedPayload) => {
      const currentPeerConnection = peerConnectionRef.current;
      const currentReadyState = callReadyRef.current;

      if (!currentPeerConnection || !currentReadyState) {
        pendingAnswerRef.current = payload;
        return Promise.resolve();
      }

      return enqueueOperation(async () => {
        assertRemoteParticipant(payload.fromParticipantId);

        if (!currentReadyState.shouldCreateOffer) {
          throw new WebRtcSignalingError({
            code: "UNEXPECTED_WEBRTC_ANSWER",
            event: "webrtc-answer",
            message: "A resposta WebRTC foi recebida pelo participante errado.",
          });
        }

        if (processedAnswerSdpRef.current === payload.description.sdp) {
          return;
        }

        if (
          !canApplyAnswer({
            signalingState: currentPeerConnection.signalingState,
            hasRemoteDescription:
              currentPeerConnection.remoteDescription !== null,
          })
        ) {
          throw new WebRtcSignalingError({
            code: "INVALID_STATE_FOR_WEBRTC_ANSWER",
            event: "webrtc-answer",
            message: "A conexão não está pronta para receber esta resposta.",
          });
        }

        await currentPeerConnection.setRemoteDescription(payload.description);
        processedAnswerSdpRef.current = payload.description.sdp;
        await flushPendingCandidates(currentPeerConnection);
        setStatus("negotiated");
        setError(null);
      });
    },
    [assertRemoteParticipant, enqueueOperation, flushPendingCandidates],
  );

  const processIceCandidate = useCallback(
    (payload: WebRtcIceCandidateReceivedPayload) => {
      const currentPeerConnection = peerConnectionRef.current;

      if (!currentPeerConnection) {
        pendingCandidatesRef.current.push(payload.candidate);
        return Promise.resolve();
      }

      return enqueueOperation(async () => {
        assertRemoteParticipant(payload.fromParticipantId);

        if (currentPeerConnection.signalingState === "closed") {
          return;
        }

        if (shouldQueueIceCandidate(currentPeerConnection.remoteDescription)) {
          pendingCandidatesRef.current.push(payload.candidate);
          return;
        }

        await currentPeerConnection.addIceCandidate(payload.candidate);
      });
    },
    [assertRemoteParticipant, enqueueOperation],
  );

  useEffect(() => {
    return subscribeToWebRtcSignaling({
      onOffer: (payload) => void processOffer(payload),
      onAnswer: (payload) => void processAnswer(payload),
      onIceCandidate: (payload) => void processIceCandidate(payload),
      onCallLeft: (payload) =>
        onCallTerminatedRef.current?.({ type: "call-left", payload }),
      onParticipantLeft: (payload) =>
        onCallTerminatedRef.current?.({
          type: "participant-left",
          payload,
        }),
      onError: reportError,
      onDisconnect: () => {
        setStatus("disconnected");
        reportError(
          new WebRtcSignalingError({
            code: "SOCKET_DISCONNECTED",
            event: "disconnect",
            message: "A conexão com a sala foi interrompida.",
          }),
        );
        onCallTerminatedRef.current?.({ type: "socket-disconnected" });
      },
    });
  }, [processAnswer, processIceCandidate, processOffer, reportError]);

  useEffect(() => {
    if (!peerConnection || !callReady) {
      return;
    }

    const pendingOffer = pendingOfferRef.current;
    const pendingAnswer = pendingAnswerRef.current;
    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;

    if (pendingOffer) {
      void processOffer(pendingOffer);
    }

    if (pendingAnswer) {
      void processAnswer(pendingAnswer);
    }
  }, [callReady, peerConnection, processAnswer, processOffer]);

  const createAndSendOffer = useCallback(
    ({ iceRestart = false }: { iceRestart?: boolean } = {}) => {
      const currentPeerConnection = peerConnectionRef.current;
      const currentReadyState = callReadyRef.current;

      if (!currentPeerConnection || !currentReadyState?.shouldCreateOffer) {
        return Promise.resolve();
      }

      return enqueueOperation(async () => {
        if (
          !iceRestart &&
          !canCreateOffer({
            signalingState: currentPeerConnection.signalingState,
            hasLocalDescription:
              currentPeerConnection.localDescription !== null,
          })
        ) {
          return;
        }

        if (currentPeerConnection.signalingState === "closed") {
          return;
        }

        setStatus("creating-offer");

        if (iceRestart) {
          currentPeerConnection.restartIce();
        }

        const offer = await currentPeerConnection.createOffer({ iceRestart });
        await currentPeerConnection.setLocalDescription(offer);

        if (!offer.sdp) {
          throw new WebRtcSignalingError({
            code: "EMPTY_WEBRTC_OFFER",
            event: "webrtc-offer",
            message: "O navegador não conseguiu criar a oferta da chamada.",
          });
        }

        sendWebRtcOffer({
          description: { type: "offer", sdp: offer.sdp },
        });
        setStatus("waiting-for-answer");
        setError(null);
      });
    },
    [enqueueOperation],
  );

  useEffect(() => {
    if (
      !peerConnection ||
      !callReady?.shouldCreateOffer ||
      offerPeerRef.current === peerConnection
    ) {
      return;
    }

    offerPeerRef.current = peerConnection;
    void createAndSendOffer();
  }, [callReady, createAndSendOffer, peerConnection]);

  useEffect(() => {
    if (!peerConnection) {
      return;
    }

    const handleIceCandidate = ({ candidate }: RTCPeerConnectionIceEvent) => {
      try {
        sendWebRtcIceCandidate({
          candidate: toIceCandidatePayload(candidate),
        });
      } catch (cause: unknown) {
        reportError(cause);
      }
    };

    peerConnection.addEventListener("icecandidate", handleIceCandidate);

    return () => {
      peerConnection.removeEventListener("icecandidate", handleIceCandidate);
    };
  }, [peerConnection, reportError]);

  const retryConnection = useCallback(() => {
    setError(null);
    return createAndSendOffer({ iceRestart: true });
  }, [createAndSendOffer]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const currentStatus =
    connectionState === "connected" ||
    connectionState === "disconnected" ||
    connectionState === "failed" ||
    connectionState === "closed"
      ? connectionState
      : peerConnection
        ? status
        : "closed";

  return {
    status: currentStatus,
    error,
    errorMessage: error?.message ?? null,
    isError: error !== null,
    retryConnection,
    clearError,
  };
}
