"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  leaveCall as leaveCallService,
  resetCallSignaling,
  resetParticipantReady,
} from "@/core/services/call-signaling-service";
import { useCallStore } from "@/core/store/call-store";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import {
  useAutomaticCallRecovery,
  isTransientCallCode,
} from "./use-automatic-call-recovery";

import { useJoinCall } from "@/core/hooks/use-join-call";
import { useLocalMedia } from "@/core/hooks/use-local-media";
import { useMediaControls } from "@/core/hooks/use-media-controls";
import { useParticipantReady } from "@/core/hooks/use-participant-ready";
import { usePeerConnection } from "@/core/hooks/use-peer-connection";
import {
  type CallTermination,
  useWebRtcSignaling,
} from "@/core/hooks/use-webrtc-signaling";

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
    error: joinCallError,
  } = useJoinCall();
  const mediaControls = useMediaControls();
  const resetCallState = useCallStore((state) => state.resetCallState);
  const clearParticipantReadiness = useCallStore(
    (state) => state.clearParticipantReadiness,
  );
  const [hasRemoteParticipantLeft, setHasRemoteParticipantLeft] =
    useState(false);
  const [termination, setTermination] = useState<CallTermination | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const isInitializingRef = useRef(false);
  const roomJoined = useRoomSessionStore((state) => state.isJoined);
  const reconnectingRoom = useRoomSessionStore((state) => state.isReconnecting);

  const cleanupCall = useCallback(() => {
    closePeerConnection();
    stopLocalMedia();
    resetCallSignaling();
    resetCallState();
  }, [closePeerConnection, resetCallState, stopLocalMedia]);

  const handleCallTerminated = useCallback(
    (termination: CallTermination) => {
      if (termination.type === "socket-disconnected") {
        closePeerConnection();
        resetCallSignaling();
        useCallStore.getState().clearJoinedCall();
        setTermination(termination);
        return;
      }
      if (termination.type !== "participant-left") {
        cleanupCall();
        setTermination(termination);
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
    setTermination(null);

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
    let isCancelled = false;

    queueMicrotask(() => {
      if (!isCancelled) {
        void initializeCall();
      }
    });

    return () => {
      isCancelled = true;
    };
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
    setTermination(null);
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

  useAutomaticCallRecovery({
    enabled: roomJoined && !reconnectingRoom && !isLeaving,
    needed:
      !isLocalMediaError &&
      (termination?.type === "socket-disconnected" ||
        isTransientCallCode(joinCallError?.code) ||
        connectionState === "failed"),
    busy: isRequesting || isJoining,
    recovered: connectionState === "connected",
    recover: retryCall,
  });

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
    termination,
    leaveCall,
    retryCall,
    ...mediaControls,
  };
}

export type CallSession = ReturnType<typeof useCallSession>;
