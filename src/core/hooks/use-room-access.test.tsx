import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRoomAccess } from "@/core/hooks/use-room-access";
import {
  createRoom,
  joinRoomWithReconnectRetry,
  RoomAccessError,
} from "@/core/services/room-service";
import { useRoomSessionStore } from "@/core/store/room-session-store";

vi.mock("@/core/services/room-service", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/core/services/room-service")>();

  return {
    ...original,
    createRoom: vi.fn(),
    joinRoomWithReconnectRetry: vi.fn(),
  };
});

function Wrapper({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const createForm = {
  title: "Daily",
  nickname: "Danilo",
  password: "secret",
  targetLanguage: "PT-BR" as const,
};

const createdRoom = {
  roomId: "room-id",
  code: "ABC-234-K9X",
  title: "Daily",
  status: "ACTIVE" as const,
  adminParticipantId: "admin-id",
};

const joinedRoom = {
  room: {
    id: "room-id",
    code: "ABC-234-K9X",
    title: "Daily",
    status: "ACTIVE" as const,
    participants: [],
  },
  participant: {
    id: "admin-id",
    roomId: "room-id",
    name: "Danilo",
    role: "ADM" as const,
    createdAt: "2026-07-20T12:00:00.000Z",
  },
};

describe("useRoomAccess", () => {
  beforeEach(() => {
    vi.mocked(createRoom).mockReset();
    vi.mocked(joinRoomWithReconnectRetry).mockReset();
    window.sessionStorage.clear();
    useRoomSessionStore.getState().clearSession();
  });

  it("retries only join_room after the room was already created", async () => {
    vi.mocked(createRoom).mockResolvedValue(createdRoom);
    vi.mocked(joinRoomWithReconnectRetry)
      .mockRejectedValueOnce(
        new RoomAccessError({
          code: "SOCKET_CONNECTION_FAILED",
          message: "offline",
        }),
      )
      .mockResolvedValueOnce(joinedRoom);
    const { result } = renderHook(() => useRoomAccess(), { wrapper: Wrapper });

    await expect(
      act(async () => {
        await result.current.createAndEnterRoom(createForm);
      }),
    ).rejects.toBeInstanceOf(RoomAccessError);

    await act(async () => {
      await result.current.createAndEnterRoom(createForm);
    });

    expect(createRoom).toHaveBeenCalledTimes(1);
    expect(joinRoomWithReconnectRetry).toHaveBeenCalledTimes(2);
    expect(joinRoomWithReconnectRetry).toHaveBeenLastCalledWith(
      {
        roomCode: "ABC-234-K9X",
        password: "secret",
        nickname: "Danilo",
        targetLanguage: "PT-BR",
        participantId: "admin-id",
      },
      expect.anything(),
    );
  });
});
