import { create } from "zustand";
import type { DeepLTargetLanguage } from "@/core/components";
import { isDeepLTargetLanguage } from "@/core/components/selector-country/countryList";

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
  spokenLanguage?: DeepLTargetLanguage;
};

type RoomSessionStore = {
  room: Room | null;
  participant: RoomParticipant | null;
  resumeSession: ResumeRoomSession | null;
  isJoined: boolean;
  isHydrated: boolean;
  spokenLanguage: DeepLTargetLanguage;
  setSpokenLanguage: (language: DeepLTargetLanguage) => void;
  setTargetLanguage: (
    roomId: string,
    participantId: string,
    language: DeepLTargetLanguage,
  ) => void;
  hydrate: () => void;
  setJoinedSession: (
    payload: RoomJoinedPayload,
    spokenLanguage?: DeepLTargetLanguage,
  ) => void;
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
  spokenLanguage: "PT-BR",
  setTargetLanguage: (roomId, participantId, targetLanguage) =>
    set((state) => {
      if (state.room?.id !== roomId || state.participant?.id !== participantId)
        return state;
      const participant = { ...state.participant, targetLanguage };
      const room = {
        ...state.room,
        participants: state.room.participants.map((item) =>
          item.id === participantId ? { ...item, targetLanguage } : item,
        ),
      };
      const resumeSession = state.resumeSession
        ? { ...state.resumeSession, targetLanguage }
        : null;
      if (resumeSession)
        window.sessionStorage.setItem(
          ROOM_SESSION_STORAGE_KEY,
          JSON.stringify(resumeSession),
        );
      return { participant, room, resumeSession };
    }),
  hydrate: () =>
    set((state) => {
      const resumeSession = state.resumeSession ?? readStoredSession();
      return {
        resumeSession,
        spokenLanguage: isDeepLTargetLanguage(resumeSession?.spokenLanguage)
          ? resumeSession.spokenLanguage
          : "PT-BR",
        isHydrated: true,
      };
    }),
  setSpokenLanguage: (spokenLanguage) =>
    set((state) => {
      if (!isDeepLTargetLanguage(spokenLanguage)) return state;
      const resumeSession = state.resumeSession
        ? { ...state.resumeSession, spokenLanguage }
        : null;
      if (resumeSession)
        window.sessionStorage.setItem(
          ROOM_SESSION_STORAGE_KEY,
          JSON.stringify(resumeSession),
        );
      return { spokenLanguage, resumeSession };
    }),
  setJoinedSession: (payload, selectedLanguage) =>
    set((state) => {
      const sameIdentity =
        state.resumeSession?.roomId === payload.room.id &&
        state.resumeSession?.participantId === payload.participant.id;
      const spokenLanguage =
        selectedLanguage ?? (sameIdentity ? state.spokenLanguage : "PT-BR");
      const resumeSession = { ...createResumeSession(payload), spokenLanguage };
      window.sessionStorage.setItem(
        ROOM_SESSION_STORAGE_KEY,
        JSON.stringify(resumeSession),
      );
      return {
        room: payload.room,
        participant: payload.participant,
        resumeSession,
        isJoined: true,
        isHydrated: true,
        spokenLanguage,
      };
    }),
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
      spokenLanguage: "PT-BR",
    });
  },
}));
