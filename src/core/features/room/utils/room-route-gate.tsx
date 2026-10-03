"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { isRoomCodeValid } from "@/core/@types/room";
import { RoomScreen } from "@/core/features/room";
import { useRoomSessionStore } from "@/core/store/room-session-store";

export function RoomRouteGate({ roomCode }: { roomCode: string }) {
  const router = useRouter();
  const normalizedRoomCode = roomCode.trim().toUpperCase();
  const hydrate = useRoomSessionStore((state) => state.hydrate);
  const isHydrated = useRoomSessionStore((state) => state.isHydrated);
  const isJoined = useRoomSessionStore((state) => state.isJoined);
  const currentRoomCode = useRoomSessionStore((state) => state.room?.code);
  const resumeSession = useRoomSessionStore((state) => state.resumeSession);
  const wasJoinedRef = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isRoomCodeValid(normalizedRoomCode)) {
      router.replace("/");
      return;
    }

    if (isJoined && currentRoomCode === normalizedRoomCode) {
      wasJoinedRef.current = true;
      return;
    }

    // Explicit exit clears the resumable identity: do not race its Home navigation.
    if (wasJoinedRef.current && !resumeSession) {
      router.replace("/");
      return;
    }

    router.replace(`/?roomCode=${encodeURIComponent(normalizedRoomCode)}`);
  }, [
    currentRoomCode,
    isHydrated,
    isJoined,
    normalizedRoomCode,
    resumeSession,
    router,
  ]);

  if (!isHydrated || !isJoined || currentRoomCode !== normalizedRoomCode) {
    return null;
  }

  return <RoomScreen />;
}
