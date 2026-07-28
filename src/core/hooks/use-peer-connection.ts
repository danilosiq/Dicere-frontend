"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  closePeerConnection as closePeerConnectionService,
  createPeerConnection as createPeerConnectionService,
  syncLocalStreamTracks,
} from "@/core/services/peer-connection-service";
import { stopMediaStream } from "@/core/services/media-service";
import {
  type PeerConnectionStates,
  useCallStore,
} from "@/core/store/call-store";

type CreatePeerConnectionParams = {
  configuration?: RTCConfiguration;
};

function getPeerConnectionStates(
  peerConnection: RTCPeerConnection,
): PeerConnectionStates {
  return {
    connectionState: peerConnection.connectionState,
    iceConnectionState: peerConnection.iceConnectionState,
    iceGatheringState: peerConnection.iceGatheringState,
    signalingState: peerConnection.signalingState,
  };
}

export function usePeerConnection() {
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const connectionState = useCallStore((state) => state.connectionState);
  const iceConnectionState = useCallStore((state) => state.iceConnectionState);
  const iceGatheringState = useCallStore((state) => state.iceGatheringState);
  const signalingState = useCallStore((state) => state.signalingState);
  const setRemoteStream = useCallStore((state) => state.setRemoteStream);
  const clearRemoteStream = useCallStore((state) => state.clearRemoteStream);
  const setPeerConnectionStates = useCallStore(
    (state) => state.setPeerConnectionStates,
  );
  const clearPeerConnectionStates = useCallStore(
    (state) => state.clearPeerConnectionStates,
  );
  const [peerConnection, setPeerConnection] =
    useState<RTCPeerConnection | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const remoteStreamRef = useRef<MediaStream | null>(remoteStream);
  const remoteTrackCleanupRef = useRef(new Map<MediaStreamTrack, () => void>());
  const isMountedRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;

    if (peerConnectionRef.current) {
      syncLocalStreamTracks({
        peerConnection: peerConnectionRef.current,
        stream: localStream,
      });
    }
  }, [localStream]);

  const closePeerConnection = useCallback(() => {
    const currentPeerConnection = peerConnectionRef.current;
    const currentRemoteStream = remoteStreamRef.current;

    peerConnectionRef.current = null;
    remoteStreamRef.current = null;

    remoteTrackCleanupRef.current.forEach((handleTrackEnded, track) => {
      track.removeEventListener("ended", handleTrackEnded);
    });
    remoteTrackCleanupRef.current.clear();

    closePeerConnectionService({ peerConnection: currentPeerConnection });
    stopMediaStream({ stream: currentRemoteStream });
    clearRemoteStream(currentRemoteStream ?? undefined);
    clearPeerConnectionStates();

    if (isMountedRef.current) {
      setPeerConnection(null);
    }
  }, [clearPeerConnectionStates, clearRemoteStream]);

  const createPeerConnection = useCallback(
    ({ configuration }: CreatePeerConnectionParams = {}) => {
      const currentPeerConnection = peerConnectionRef.current;

      if (
        currentPeerConnection &&
        currentPeerConnection.signalingState !== "closed"
      ) {
        return currentPeerConnection;
      }

      const nextPeerConnection = createPeerConnectionService({
        configuration,
      });
      const nextRemoteStream = new MediaStream();

      peerConnectionRef.current = nextPeerConnection;
      remoteStreamRef.current = nextRemoteStream;

      const updateConnectionStates = () => {
        if (peerConnectionRef.current !== nextPeerConnection) {
          return;
        }

        setPeerConnectionStates(getPeerConnectionStates(nextPeerConnection));
      };

      nextPeerConnection.onconnectionstatechange = updateConnectionStates;
      nextPeerConnection.oniceconnectionstatechange = updateConnectionStates;
      nextPeerConnection.onicegatheringstatechange = updateConnectionStates;
      nextPeerConnection.onsignalingstatechange = updateConnectionStates;
      nextPeerConnection.ontrack = ({ track }) => {
        if (peerConnectionRef.current !== nextPeerConnection) {
          return;
        }

        const hasTrack = nextRemoteStream
          .getTracks()
          .some((remoteTrack) => remoteTrack.id === track.id);

        if (!hasTrack) {
          nextRemoteStream.addTrack(track);

          const handleTrackEnded = () => {
            track.removeEventListener("ended", handleTrackEnded);
            remoteTrackCleanupRef.current.delete(track);
            nextRemoteStream.removeTrack(track);

            if (peerConnectionRef.current !== nextPeerConnection) {
              return;
            }

            const remainingTracks = nextRemoteStream.getTracks();

            if (remainingTracks.length === 0) {
              const currentRemoteStream = remoteStreamRef.current;
              remoteStreamRef.current = null;
              clearRemoteStream(currentRemoteStream ?? undefined);
              return;
            }

            const updatedRemoteStream = new MediaStream(remainingTracks);
            remoteStreamRef.current = updatedRemoteStream;
            setRemoteStream(updatedRemoteStream);
          };

          remoteTrackCleanupRef.current.set(track, handleTrackEnded);
          track.addEventListener("ended", handleTrackEnded);
        }

        // Publica uma nova instância para que seletores do Zustand e o React
        // percebam quando áudio e vídeo chegam em eventos `track` separados.
        const updatedRemoteStream = new MediaStream(
          nextRemoteStream.getTracks(),
        );
        remoteStreamRef.current = updatedRemoteStream;
        setRemoteStream(updatedRemoteStream);
      };

      syncLocalStreamTracks({
        peerConnection: nextPeerConnection,
        stream: localStreamRef.current,
      });
      setPeerConnectionStates(getPeerConnectionStates(nextPeerConnection));

      if (isMountedRef.current) {
        setPeerConnection(nextPeerConnection);
      }

      return nextPeerConnection;
    },
    [clearRemoteStream, setPeerConnectionStates, setRemoteStream],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      closePeerConnection();
    };
  }, [closePeerConnection]);

  return {
    peerConnection,
    localStream,
    remoteStream,
    connectionState,
    iceConnectionState,
    iceGatheringState,
    signalingState,
    createPeerConnection,
    closePeerConnection,
  };
}
