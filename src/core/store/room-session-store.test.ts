import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => vi.restoreAllMocks());
  it("keeps admission, language updates and exit working when storage is blocked", () => {
    for (const method of ["getItem", "setItem", "removeItem"] as const)
      vi.spyOn(Storage.prototype, method).mockImplementation(() => {
        throw new DOMException("Blocked", "SecurityError");
      });
    const state = useRoomSessionStore.getState();
    state.hydrate();
    state.setJoinedSession(joinedRoom, "ES");
    state.setReconnecting(true);
    state.setJoinedSession(joinedRoom);
    state.setSpokenLanguage("EN");
    state.setTargetLanguage("room-id", "participant-id", "ZH");
    expect(useRoomSessionStore.getState()).toMatchObject({
      isJoined: true,
      isReconnecting: false,
      spokenLanguage: "EN",
      participant: { targetLanguage: "ZH" },
    });
    state.clearSession();
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
  });
  it("shares and persists spoken language independently from translation target", () => {
    const state = useRoomSessionStore.getState();
    state.setJoinedSession(
      {
        ...joinedRoom,
        participant: { ...joinedRoom.participant, targetLanguage: "PT-BR" },
      },
      "ES",
    );
    expect(useRoomSessionStore.getState().spokenLanguage).toBe("ES");
    state.setSpokenLanguage("EN");
    expect(useRoomSessionStore.getState().participant?.targetLanguage).toBe(
      "PT-BR",
    );
    expect(
      JSON.parse(window.sessionStorage.getItem("dicere-room-session")!)
        .spokenLanguage,
    ).toBe("EN");
    state.setJoinedSession(joinedRoom);
    expect(useRoomSessionStore.getState().spokenLanguage).toBe("EN");
    state.setJoinedSession({
      ...joinedRoom,
      participant: { ...joinedRoom.participant, id: "another" },
    });
    expect(useRoomSessionStore.getState().spokenLanguage).toBe("PT-BR");
  });
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
