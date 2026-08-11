import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RoomJoinedPayload } from "@/core/@types/room";
import type { DicereSocket } from "@/core/services/socket-service";
import { getSocket } from "@/core/services/socket-service";
import { joinRoom } from "@/core/services/room-service";

vi.mock("@/core/services/socket-service", () => ({
  getSocket: vi.fn(),
}));

type Handler = (...args: never[]) => void;

function makeSocket() {
  const handlers = new Map<string, Set<Handler>>();
  const socket = {
    connected: true,
    on: vi.fn((event: string, handler: Handler) => {
      const currentHandlers = handlers.get(event) ?? new Set<Handler>();
      currentHandlers.add(handler);
      handlers.set(event, currentHandlers);
      return socket;
    }),
    once: vi.fn((event: string, handler: Handler) => {
      const onceHandler = ((...args: never[]) => {
        socket.off(event, onceHandler);
        handler(...args);
      }) as Handler;
      socket.on(event, onceHandler);
      return socket;
    }),
    off: vi.fn((event: string, handler: Handler) => {
      handlers.get(event)?.delete(handler);
      return socket;
    }),
    emit: vi.fn(),
    connect: vi.fn(),
  };

  return {
    socket: socket as unknown as DicereSocket,
    serverEmit(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload as never));
    },
    listenerCount(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
  };
}

const payload = {
  roomCode: "ABC-234-K9X",
  password: "secret",
  nickname: "Maria",
  targetLanguage: "PT-BR",
};

const confirmation: RoomJoinedPayload = {
  room: {
    id: "room-id",
    code: "ABC-234-K9X",
    title: "Daily",
    status: "ACTIVE",
    participants: [],
  },
  participant: {
    id: "guest-id",
    roomId: "room-id",
    name: "Maria",
    role: "GUEST",
    createdAt: "2026-07-20T12:00:00.000Z",
  },
};

describe("room service", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("resolves room_joined and removes temporary listeners", async () => {
    const fake = makeSocket();
    vi.mocked(getSocket).mockReturnValue(fake.socket);

    const request = joinRoom(payload);
    fake.serverEmit("room_joined", confirmation);

    await expect(request).resolves.toEqual(confirmation);
    expect(fake.socket.emit).toHaveBeenCalledWith("join_room", payload);
    expect(fake.listenerCount("room_joined")).toBe(0);
    expect(fake.listenerCount("error")).toBe(0);
    expect(fake.listenerCount("disconnect")).toBe(0);
  });

  it("rejects only structured join_room errors", async () => {
    const fake = makeSocket();
    vi.mocked(getSocket).mockReturnValue(fake.socket);

    const request = joinRoom(payload);
    fake.serverEmit("error", {
      event: "join_room",
      code: "INVALID_ROOM_PASSWORD",
      message: "Senha inválida",
    });

    await expect(request).rejects.toMatchObject({
      code: "INVALID_ROOM_PASSWORD",
      message: "Senha incorreta.",
    });
  });
});
