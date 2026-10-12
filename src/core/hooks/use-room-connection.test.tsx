import { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomConnection } from "@/core/hooks/use-room-connection";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import {
  forgetRoomCredentials,
  getRoomCredentials,
  rememberRoomCredentials,
} from "@/core/services/room-reconnect-credentials";

const socket = vi.hoisted(() => ({
  id: "socket-id",
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
}));
const disconnect = vi.hoisted(() => vi.fn());
const join = vi.hoisted(() => vi.fn());
vi.mock("@/core/services/room-service", () => ({
  joinRoomWithReconnectRetry: join,
  RoomAccessError: class extends Error {},
}));
vi.mock("@/core/services/socket-service", () => ({
  getSocket: () => socket,
  disconnectSocket: disconnect,
}));

describe("room connection lifecycle", () => {
  beforeEach(() => {
    forgetRoomCredentials("room-id", "participant-id");
    vi.clearAllMocks();
    socket.id = "socket-id";
    socket.connected = true;
    useRoomSessionStore.setState({
      room: {
        id: "room-id",
        code: "ABC-234-K9X",
        title: "Daily",
        status: "ACTIVE",
        participants: [],
      },
      participant: {
        id: "participant-id",
        roomId: "room-id",
        name: "Maria",
        role: "GUEST",
        createdAt: "2026-10-02",
      },
      resumeSession: {
        roomId: "room-id",
        roomCode: "ABC-234-K9X",
        roomTitle: "Daily",
        roomStatus: "ACTIVE",
        participantId: "participant-id",
        nickname: "Maria",
        role: "GUEST",
      },
      isJoined: true,
      isReconnecting: false,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    forgetRoomCredentials("room-id", "participant-id");
  });

  function rememberAdmission() {
    const { room, participant } = useRoomSessionStore.getState();
    const joined = { room: room!, participant: participant! };
    rememberRoomCredentials(
      {
        roomCode: room!.code,
        password: "volatile-only",
        targetLanguage: "PT-BR",
        nickname: participant!.name,
      },
      joined,
    );
    return joined;
  }

  it("retains room intent through disconnect and readmits before clearing recovery", async () => {
    vi.useFakeTimers();
    const joined = rememberAdmission();
    useRoomSessionStore.getState().setSpokenLanguage("ES");
    join.mockImplementation(async () => {
      socket.id = "readmitted-socket";
      return joined;
    });
    const view = renderHook(useRoomConnection);
    const lost = socket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )![1];
    act(() => lost());
    expect(useRoomSessionStore.getState()).toMatchObject({
      isJoined: true,
      isReconnecting: true,
      spokenLanguage: "ES",
    });
    expect(disconnect).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(500));
    expect(join).toHaveBeenCalledWith(
      expect.objectContaining({ participantId: "participant-id" }),
      expect.any(AbortSignal),
    );
    expect(useRoomSessionStore.getState()).toMatchObject({
      isJoined: true,
      isReconnecting: false,
      spokenLanguage: "ES",
    });
    view.unmount();
    await act(async () => {});
    expect(disconnect).toHaveBeenCalledOnce();
    expect(getRoomCredentials("room-id", "participant-id")).toBeUndefined();
  });

  it("ignores late readmission and clears credentials when leaving during recovery", async () => {
    vi.useFakeTimers();
    const joined = rememberAdmission();
    let release!: (value: typeof joined) => void;
    join.mockImplementation(
      () =>
        new Promise((resolve) => {
          socket.id = "connecting-socket";
          release = resolve;
        }),
    );
    renderHook(useRoomConnection);
    act(() =>
      socket.on.mock.calls.find(([event]) => event === "disconnect")![1](),
    );
    await act(() => vi.advanceTimersByTimeAsync(500));
    act(() => window.dispatchEvent(new Event("pagehide")));
    release(joined);
    await act(() => vi.advanceTimersByTimeAsync(60000));
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
    expect(getRoomCredentials("room-id", "participant-id")).toBeUndefined();
    expect(join).toHaveBeenCalledOnce();
  });

  it("disconnects on pagehide, keeping only the resumable identity", () => {
    renderHook(useRoomConnection);
    act(() => window.dispatchEvent(new Event("pagehide")));
    expect(disconnect).toHaveBeenCalledOnce();
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
    expect(useRoomSessionStore.getState().resumeSession?.participantId).toBe(
      "participant-id",
    );
  });

  it("invalidates the active session on a transport disconnect", () => {
    renderHook(useRoomConnection);
    const handler = socket.on.mock.calls.find(
      ([event]) => event === "disconnect",
    )?.[1];
    act(() => handler());
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
    expect(useRoomSessionStore.getState().resumeSession).not.toBeNull();
  });

  it("releases the socket on SPA navigation but not Strict Mode's effect replay", async () => {
    const view = renderHook(useRoomConnection, {
      wrapper: ({ children }: PropsWithChildren) => (
        <StrictMode>{children}</StrictMode>
      ),
    });
    await act(async () => {});
    expect(disconnect).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => {});
    expect(disconnect).toHaveBeenCalledOnce();
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
  });

  it("does not let old screen cleanup disconnect a newly joined socket", async () => {
    const view = renderHook(useRoomConnection);
    view.unmount();
    socket.id = "new-socket-id";
    await act(async () => {});
    expect(disconnect).not.toHaveBeenCalled();
    expect(useRoomSessionStore.getState().isJoined).toBe(true);
  });
});
