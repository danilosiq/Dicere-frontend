import { describe, expect, it } from "vitest";

import { createRoomSchema } from "@/core/forms/create-room-form/schema";
import { joinRoomSchema } from "@/core/forms/join-room-form/schema";

describe("room form schemas", () => {
  it("validates the create room limits", () => {
    expect(
      createRoomSchema.safeParse({
        title: "",
        nickname: "Danilo",
        password: "secret",
        targetLanguage: "PT-BR",
      }).success,
    ).toBe(false);
    expect(
      createRoomSchema.safeParse({
        title: "a".repeat(51),
        nickname: "Danilo",
        password: "secret",
        targetLanguage: "PT-BR",
      }).success,
    ).toBe(false);
    expect(
      createRoomSchema.safeParse({
        title: "Daily",
        nickname: "Danilo",
        password: "12345",
        targetLanguage: "PT-BR",
      }).success,
    ).toBe(false);
  });

  it("accepts only the public room code format", () => {
    expect(
      joinRoomSchema.safeParse({
        roomCode: "ABC-234-K9X",
        name: "Maria",
        password: "secret",
        targetLanguage: "PT-BR",
      }).success,
    ).toBe(true);
    expect(
      joinRoomSchema.safeParse({
        roomCode: "ABC234K9X",
        name: "Maria",
        password: "secret",
        targetLanguage: "PT-BR",
      }).success,
    ).toBe(false);
    expect(
      joinRoomSchema.safeParse({
        roomCode: "A0C-234-K9X",
        name: "Maria",
        password: "secret",
        targetLanguage: "PT-BR",
      }).success,
    ).toBe(false);
  });
});
