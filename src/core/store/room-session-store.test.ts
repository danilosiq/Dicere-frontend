import { beforeEach, describe, expect, it } from "vitest";

import { useRoomSessionStore } from "@/core/store/room-session-store";

const joinedRoom = {
  room: {
    id: "room-id",
    code: "ABC-234-K9X",
    title: "Daily",
    status: "ACTIVE" as const,
    participants: [],
  },
  participant: {
    id: "participant-id",
    roomId: "room-id",
    name: "Danilo",
    role: "ADM" as const,
    createdAt: "2026-07-20T12:00:00.000Z",
  },
};

describe("room session store", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    useRoomSessionStore.getState().clearSession();
  });

  it("persists only the resumable non-sensitive identity", () => {
    useRoomSessionStore.getState().setJoinedSession(joinedRoom);

    const storedValue = window.sessionStorage.getItem("dicere-room-session");

    expect(storedValue).toContain("participant-id");
    expect(storedValue).toContain("ABC-234-K9X");
    expect(storedValue).not.toContain("password");
    expect(useRoomSessionStore.getState().isJoined).toBe(true);
  });

  it("hydrates a resume candidate without considering the socket joined", () => {
    useRoomSessionStore.getState().setJoinedSession(joinedRoom);
    const storedValue = window.sessionStorage.getItem("dicere-room-session");
    useRoomSessionStore.setState({
      room: null,
      participant: null,
      resumeSession: null,
      isJoined: false,
      isHydrated: false,
    });
    window.sessionStorage.setItem("dicere-room-session", storedValue!);

    useRoomSessionStore.getState().hydrate();

    expect(useRoomSessionStore.getState().resumeSession?.participantId).toBe(
      "participant-id",
    );
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
  });
});
