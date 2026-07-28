import { create } from "zustand";

import type {
  ParticipantRole,
  Room,
  RoomJoinedPayload,
  RoomParticipant,
  RoomStatus,
} from "@/core/@types/room";

const ROOM_SESSION_STORAGE_KEY = "dicere-room-session";

export type ResumeRoomSession = {
  roomId: string;
  roomCode: string;
  roomTitle: string;
  roomStatus: RoomStatus;
  participantId: string;
  nickname: string;
  role: ParticipantRole;
  targetLanguage?: string | null;
};

type RoomSessionStore = {
  room: Room | null;
  participant: RoomParticipant | null;
  resumeSession: ResumeRoomSession | null;
  isJoined: boolean;
  isHydrated: boolean;
  hydrate: () => void;
  setJoinedSession: (payload: RoomJoinedPayload) => void;
  clearActiveSession: () => void;
  clearSession: () => void;
};

function readStoredSession(): ResumeRoomSession | null {
  if (typeof window === "undefined") return null;

  const value = window.sessionStorage.getItem(ROOM_SESSION_STORAGE_KEY);
  if (!value) return null;

  try {
    return JSON.parse(value) as ResumeRoomSession;
  } catch {
    window.sessionStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
    return null;
  }
}

function createResumeSession({
  room,
  participant,
}: RoomJoinedPayload): ResumeRoomSession {
  return {
    roomId: room.id,
    roomCode: room.code,
    roomTitle: room.title,
    roomStatus: room.status,
    participantId: participant.id,
    nickname: participant.name,
    role: participant.role,
    targetLanguage: participant.targetLanguage,
  };
}

export const useRoomSessionStore = create<RoomSessionStore>((set) => ({
  room: null,
  participant: null,
  resumeSession: null,
  isJoined: false,
  isHydrated: false,
  hydrate: () =>
    set((state) => ({
      resumeSession: state.resumeSession ?? readStoredSession(),
      isHydrated: true,
    })),
  setJoinedSession: (payload) => {
    const resumeSession = createResumeSession(payload);
    window.sessionStorage.setItem(
      ROOM_SESSION_STORAGE_KEY,
      JSON.stringify(resumeSession),
    );
    set({
      room: payload.room,
      participant: payload.participant,
      resumeSession,
      isJoined: true,
      isHydrated: true,
    });
  },
  clearActiveSession: () =>
    set({ room: null, participant: null, isJoined: false }),
  clearSession: () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(ROOM_SESSION_STORAGE_KEY);
    }
    set({
      room: null,
      participant: null,
      resumeSession: null,
      isJoined: false,
      isHydrated: true,
    });
  },
}));
