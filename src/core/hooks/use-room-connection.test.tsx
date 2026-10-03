import { StrictMode, type PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRoomConnection } from "@/core/hooks/use-room-connection";
import { useRoomSessionStore } from "@/core/store/room-session-store";

const socket = vi.hoisted(() => ({
  id: "socket-id",
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
}));
const disconnect = vi.hoisted(() => vi.fn());
vi.mock("@/core/services/socket-service", () => ({
  getSocket: () => socket,
  disconnectSocket: disconnect,
}));

describe("room connection lifecycle", () => {
  beforeEach(() => {
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
    });
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
