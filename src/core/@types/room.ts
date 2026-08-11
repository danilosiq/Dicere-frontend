export const ROOM_CODE_ALLOWED_CHARACTERS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_PATTERN =
  /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{3}$/;

export type RoomStatus = "ACTIVE" | "CLOSED" | "EXPIRED";
export type ParticipantRole = "ADM" | "GUEST";

export type RoomParticipant = {
  id: string;
  roomId: string;
  name: string;
  role: ParticipantRole;
  targetLanguage?: string | null;
  createdAt: string;
};

export type Room = {
  id: string;
  code: string;
  title: string;
  status: RoomStatus;
  participants: RoomParticipant[];
};

export type CreateRoomInput = {
  title: string;
  password: string;
  participantName: string;
  targetLanguage: string;
};

export type CreateRoomResult = {
  roomId: string;
  code: string;
  title: string;
  status: RoomStatus;
  adminParticipantId: string;
};

export type JoinRoomPayload = {
  roomCode: string;
  password: string;
  nickname: string;
  targetLanguage: string;
  participantId?: string;
};

export type RoomJoinedPayload = {
  room: Room;
  participant: RoomParticipant;
};

export function normalizeRoomCode(value: string) {
  const cleanValue = value
    .toUpperCase()
    .split("")
    .filter((character) => ROOM_CODE_ALLOWED_CHARACTERS.includes(character))
    .slice(0, 9)
    .join("");

  return cleanValue.match(/.{1,3}/g)?.join("-") ?? "";
}

export function isRoomCodeValid(value: string) {
  return ROOM_CODE_PATTERN.test(value.trim().toUpperCase());
}
