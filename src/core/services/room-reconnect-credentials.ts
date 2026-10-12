import type { JoinRoomPayload, RoomJoinedPayload } from "@/core/@types/room";

export type RoomReconnectCredentials = {
  roomId: string;
  participantId: string;
  payload: JoinRoomPayload;
};

// Password stays in memory for this visit only, never in a persisted store/log.
let credentials: RoomReconnectCredentials | undefined;

export function rememberRoomCredentials(
  payload: JoinRoomPayload,
  joined: RoomJoinedPayload,
) {
  credentials = {
    roomId: joined.room.id,
    participantId: joined.participant.id,
    payload: { ...payload, participantId: joined.participant.id },
  };
}

export function getRoomCredentials(roomId: string, participantId: string) {
  return credentials?.roomId === roomId &&
    credentials.participantId === participantId
    ? credentials
    : undefined;
}

export function forgetRoomCredentials(roomId: string, participantId: string) {
  if (getRoomCredentials(roomId, participantId)) credentials = undefined;
}

export function updateRoomReconnectLanguage(
  roomId: string,
  participantId: string,
  language: JoinRoomPayload["targetLanguage"],
) {
  const access = getRoomCredentials(roomId, participantId);
  if (access) access.payload = { ...access.payload, targetLanguage: language };
}
