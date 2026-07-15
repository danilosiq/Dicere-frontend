"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  leaveCall as leaveCallService,
  resetCallSignaling,
  resetParticipantReady,
} from "@/core/services/call-signaling-service";
import { useCallStore } from "@/core/store/call-store";

import { useJoinCall } from "./use-join-call";
import { useLocalMedia } from "./use-local-media";
import { useMediaControls } from "./use-media-controls";
import { useParticipantReady } from "./use-participant-ready";
import { usePeerConnection } from "./use-peer-connection";
import {
  type CallTermination,
  useWebRtcSignaling,
} from "./use-webrtc-signaling";

export function useCallSession() {
  const {
    localStream,
    startLocalMedia,
    stopLocalMedia,
    isRequesting,
    isError: isLocalMediaError,
    errorMessage: localMediaErrorMessage,
  } = useLocalMedia();
  const {
    peerConnection,
    remoteStream,
    connectionState,
    createPeerConnection,
    closePeerConnection,
  } = usePeerConnection();
  const {
    joinCall,
    isJoined,
    isJoining,
    errorMessage: joinCallErrorMessage,
  } = useJoinCall();
  const mediaControls = useMediaControls();
  const resetCallState = useCallStore((state) => state.resetCallState);
  const clearParticipantReadiness = useCallStore(
    (state) => state.clearParticipantReadiness,
  );
  const [hasRemoteParticipantLeft, setHasRemoteParticipantLeft] =
    useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const isInitializingRef = useRef(false);

  const cleanupCall = useCallback(() => {
    closePeerConnection();
    stopLocalMedia();
    resetCallSignaling();
    resetCallState();
  }, [closePeerConnection, resetCallState, stopLocalMedia]);

  const handleCallTerminated = useCallback(
    (termination: CallTermination) => {
      if (termination.type !== "participant-left") {
        cleanupCall();
        return;
      }

      closePeerConnection();
      clearParticipantReadiness();
      resetParticipantReady();
      setHasRemoteParticipantLeft(true);

      queueMicrotask(() => {
        createPeerConnection();
      });
    },
    [
      cleanupCall,
      clearParticipantReadiness,
      closePeerConnection,
      createPeerConnection,
    ],
  );

  const {
    isWaitingForParticipant,
    isError: isParticipantReadyError,
    errorMessage: participantReadyErrorMessage,
    retryParticipantReady,
  } = useParticipantReady({
    peerConnection,
  });
  const {
    status: signalingStatus,
    errorMessage: signalingErrorMessage,
    retryConnection,
  } = useWebRtcSignaling({
    peerConnection,
    onCallTerminated: handleCallTerminated,
  });

  const initializeCall = useCallback(async () => {
    if (isInitializingRef.current) {
      return;
    }

    isInitializingRef.current = true;
    setHasRemoteParticipantLeft(false);

    try {
      const stream = await startLocalMedia();

      if (!stream) {
        return;
      }

      createPeerConnection();
      await joinCall();
    } finally {
      isInitializingRef.current = false;
    }
  }, [createPeerConnection, joinCall, startLocalMedia]);

  useEffect(() => {
    void initializeCall();
  }, [initializeCall]);

  const leaveCall = useCallback(() => {
    setIsLeaving(true);

    try {
      leaveCallService({ reason: "USER_LEFT" });
    } catch {
      // A limpeza local precisa ocorrer mesmo se o socket já tiver caído.
    } finally {
      cleanupCall();
      setIsLeaving(false);
    }
  }, [cleanupCall]);

  const retryCall = useCallback(async () => {
    if (isLocalMediaError || !localStream) {
      await initializeCall();
      return;
    }

    if (!peerConnection) {
      createPeerConnection();
    }

    if (!isJoined) {
      await joinCall();
      return;
    }

    if (isParticipantReadyError) {
      retryParticipantReady();
      return;
    }

    await retryConnection();
  }, [
    createPeerConnection,
    initializeCall,
    isJoined,
    isLocalMediaError,
    isParticipantReadyError,
    joinCall,
    localStream,
    peerConnection,
    retryConnection,
    retryParticipantReady,
  ]);

  const errorMessage =
    localMediaErrorMessage ??
    joinCallErrorMessage ??
    participantReadyErrorMessage ??
    signalingErrorMessage;

  return {
    localStream,
    remoteStream,
    connectionState,
    signalingStatus,
    isStarting: isRequesting || isJoining,
    isWaitingForParticipant:
      isWaitingForParticipant || hasRemoteParticipantLeft,
    isConnected: connectionState === "connected",
    isError: errorMessage !== null,
    errorMessage,
    isLeaving,
    leaveCall,
    retryCall,
    ...mediaControls,
  };
}
