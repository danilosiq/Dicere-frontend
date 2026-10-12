import { beforeEach, expect, it } from "vitest";
import {
  rememberRoomCredentials,
  getRoomCredentials,
  forgetRoomCredentials,
  updateRoomReconnectLanguage,
} from "./room-reconnect-credentials";

const joined = {
  room: {
    id: "one",
    code: "ABC-234-K9X",
    title: "Room",
    status: "ACTIVE" as const,
    participants: [],
  },
  participant: {
    id: "user",
    roomId: "one",
    name: "Ana",
    role: "GUEST" as const,
    createdAt: "2026-10-12",
  },
};
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
it("keeps credentials only in memory and updates the confirmed target language", () => {
  rememberRoomCredentials(
    {
      roomCode: joined.room.code,
      password: "private-password",
      nickname: "Ana",
      targetLanguage: "EN",
    },
    joined,
  );
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
  expect(getRoomCredentials("one", "other-user")).toBeUndefined();
  expect(getRoomCredentials("other-room", "user")).toBeUndefined();
  updateRoomReconnectLanguage("one", "user", "ES");
  expect(getRoomCredentials("one", "user")?.payload).toMatchObject({
    participantId: "user",
    targetLanguage: "ES",
  });
  forgetRoomCredentials("other-room", "user");
  expect(getRoomCredentials("one", "user")).toBeDefined();
  forgetRoomCredentials("one", "user");
  expect(getRoomCredentials("one", "user")).toBeUndefined();
});
