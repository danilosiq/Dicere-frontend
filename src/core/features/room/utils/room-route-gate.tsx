"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isRoomCodeValid(normalizedRoomCode)) {
      router.replace("/");
      return;
    }

    if (isJoined && currentRoomCode === normalizedRoomCode) return;

    router.replace(`/?roomCode=${encodeURIComponent(normalizedRoomCode)}`);
  }, [currentRoomCode, isHydrated, isJoined, normalizedRoomCode, router]);

  if (!isHydrated || !isJoined || currentRoomCode !== normalizedRoomCode) {
    return null;
  }

  return <RoomScreen />;
}
