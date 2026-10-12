import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { RoomConnectionRecovery } from "./room-connection-recovery";
import { rememberRoomCredentials } from "./room-reconnect-credentials";
import { RoomAccessError } from "./room-service";

const mocks = vi.hoisted(() => ({
  socket: {
    id: "old",
    connected: true,
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
  },
  join: vi.fn(),
}));
vi.mock("./socket-service", () => ({ getSocket: () => mocks.socket }));
vi.mock("./room-service", () => ({
  joinRoomWithReconnectRetry: mocks.join,
  RoomAccessError: class extends Error {
    constructor(public details: { code: string }) {
      super();
    }
    get code() {
      return this.details.code;
    }
  },
}));
const joined = {
  room: {
    id: "room",
    code: "ABC-234-K9X",
    title: "Room",
    status: "ACTIVE" as const,
    participants: [],
  },
  participant: {
    id: "participant",
    roomId: "room",
    name: "Ana",
    role: "GUEST" as const,
    createdAt: "2026-10-12",
  },
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  rememberRoomCredentials(
    {
      roomCode: joined.room.code,
      password: "secret-in-memory",
      nickname: "Ana",
      targetLanguage: "EN",
    },
    joined,
  );
  mocks.join.mockResolvedValue(joined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setup() {
  const recovered = vi.fn();
  const lost = vi.fn();
  const blocked = vi.fn();
  const recovery = new RoomConnectionRecovery({
    roomId: "room",
    participantId: "participant",
    recovered,
    lost,
    blocked,
  });
  recovery.start();
  return { recovery, recovered, lost, blocked };
}

it("rejoins the same identity automatically without storing a password", async () => {
  const { recovery, recovered, lost } = setup();
  mocks.socket.on.mock.calls.find(([event]) => event === "disconnect")![1]();
  expect(lost).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(500);
  expect(mocks.join).toHaveBeenCalledWith(
    expect.objectContaining({
      participantId: "participant",
      password: "secret-in-memory",
    }),
    expect.any(AbortSignal),
  );
  expect(recovered).toHaveBeenCalledWith(joined);
  recovery.stop();
});

it("does not reconnect while offline and wakes when connectivity returns", async () => {
  const { recovery, recovered } = setup();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  window.dispatchEvent(new Event("offline"));
  expect(mocks.socket.disconnect).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(60000);
  expect(mocks.join).not.toHaveBeenCalled();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  window.dispatchEvent(new Event("online"));
  await vi.advanceTimersByTimeAsync(0);
  expect(recovered).toHaveBeenCalledOnce();
  recovery.stop();
});

it("cancels timers and ignores a late confirmation after leaving", async () => {
  let release!: (value: typeof joined) => void;
  mocks.join.mockImplementation(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const { recovery, recovered } = setup();
  mocks.socket.on.mock.calls.find(([event]) => event === "disconnect")![1]();
  await vi.advanceTimersByTimeAsync(500);
  recovery.stop();
  release(joined);
  await vi.advanceTimersByTimeAsync(60000);
  expect(recovered).not.toHaveBeenCalled();
  expect(mocks.join).toHaveBeenCalledOnce();
});

it("removes recovery listeners before reporting a permanent admission error", async () => {
  mocks.join.mockRejectedValue(
    new RoomAccessError({
      code: "INVALID_PASSWORD",
      message: "Invalid password",
    }),
  );
  const { recovery, blocked } = setup();
  const disconnect = mocks.socket.on.mock.calls.find(
    ([event]) => event === "disconnect",
  )![1];
  blocked.mockImplementation(() => disconnect());
  disconnect();
  await vi.advanceTimersByTimeAsync(500);
  expect(blocked).toHaveBeenCalledWith("INVALID_PASSWORD");
  expect(mocks.socket.off).toHaveBeenCalledWith("disconnect", disconnect);
  window.dispatchEvent(new Event("online"));
  disconnect();
  await vi.advanceTimersByTimeAsync(60000);
  expect(mocks.join).toHaveBeenCalledOnce();
  recovery.stop();
});
