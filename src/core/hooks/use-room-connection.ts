"use client";

import { useEffect, useRef } from "react";
import { disconnectSocket, getSocket } from "@/core/services/socket-service";
import { useRoomSessionStore } from "@/core/store/room-session-store";

export function useRoomConnection() {
  const clearActiveSession = useRoomSessionStore(
    (state) => state.clearActiveSession,
  );
  const generationRef = useRef(0);

  useEffect(() => {
    const socket = getSocket();
    const socketId = socket.id;
    const generation = ++generationRef.current;
    const isCurrentGeneration = () => generationRef.current === generation;
    const invalidate = () => {
      // Stop automatic transport reconnect: a new socket needs room admission.
      disconnectSocket();
      clearActiveSession();
    };
    const leavePage = () => {
      // A stale screen must never close a socket created by a subsequent join.
      if (socket.id !== socketId) return;
      disconnectSocket();
      clearActiveSession();
    };
    socket.on("disconnect", invalidate);
    window.addEventListener("pagehide", leavePage);

    return () => {
      socket.off("disconnect", invalidate);
      window.removeEventListener("pagehide", leavePage);
      // Strict Mode replays effects; only a real route departure releases the room.
      queueMicrotask(() => {
        if (isCurrentGeneration()) leavePage();
      });
    };
  }, [clearActiveSession]);
}
