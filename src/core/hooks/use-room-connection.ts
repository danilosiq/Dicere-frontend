"use client";

import { useEffect, useRef } from "react";
import { disconnectSocket, getSocket } from "@/core/services/socket-service";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { RoomConnectionRecovery } from "@/core/services/room-connection-recovery";
import {
  forgetRoomCredentials,
  getRoomCredentials,
} from "@/core/services/room-reconnect-credentials";

export function useRoomConnection() {
  const clearActiveSession = useRoomSessionStore(
    (state) => state.clearActiveSession,
  );
  const generationRef = useRef(0);

  useEffect(() => {
    const socket = getSocket();
    const initial = useRoomSessionStore.getState();
    const roomId = initial.room?.id;
    const participantId = initial.participant?.id;
    const access =
      roomId && participantId
        ? getRoomCredentials(roomId, participantId)
        : undefined;
    const recovery = access
      ? new RoomConnectionRecovery({
          roomId: access.roomId,
          participantId: access.participantId,
          lost: () => useRoomSessionStore.getState().setReconnecting(true),
          recovered: (joined) =>
            useRoomSessionStore.getState().setJoinedSession(joined),
          blocked: () => {
            disconnectSocket();
            clearActiveSession();
          },
        })
      : undefined;
    const socketId = socket.id;
    const generation = ++generationRef.current;
    const isCurrentGeneration = () => generationRef.current === generation;
    const invalidate = () => {
      // Sessions hydrated after a page reload still require password admission.
      disconnectSocket();
      clearActiveSession();
    };
    const leavePage = () => {
      // A stale screen must never close a socket created by a subsequent join.
      const current = useRoomSessionStore.getState();
      const recoveringOwnedRoom =
        current.isReconnecting &&
        current.room?.id === roomId &&
        current.participant?.id === participantId;
      if (
        socket.id !== (recovery?.socketId ?? socketId) &&
        !recoveringOwnedRoom
      )
        return;
      recovery?.stop();
      if (roomId && participantId) forgetRoomCredentials(roomId, participantId);
      disconnectSocket();
      clearActiveSession();
    };
    if (recovery) recovery.start();
    else socket.on("disconnect", invalidate);
    window.addEventListener("pagehide", leavePage);

    return () => {
      recovery?.stop();
      if (!recovery) socket.off("disconnect", invalidate);
      window.removeEventListener("pagehide", leavePage);
      // Strict Mode replays effects; only a real route departure releases the room.
      queueMicrotask(() => {
        if (isCurrentGeneration()) leavePage();
      });
    };
  }, [clearActiveSession]);
}
