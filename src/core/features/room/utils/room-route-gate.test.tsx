import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoomRouteGate } from "@/core/features/room/utils/room-route-gate";
import { useRoomSessionStore } from "@/core/store/room-session-store";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

vi.mock("@/core/features/room", () => ({
  RoomScreen: () => <div>Sala liberada</div>,
}));

describe("RoomRouteGate", () => {
  beforeEach(() => {
    replace.mockReset();
    window.sessionStorage.clear();
    useRoomSessionStore.setState({
      room: null,
      participant: null,
      resumeSession: null,
      isJoined: false,
      isHydrated: true,
    });
  });

  it("redirects a public room link to the Home when there is no active socket session", async () => {
    render(<RoomRouteGate roomCode="ABC-234-K9X" />);

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith("/?roomCode=ABC-234-K9X");
    });
  });

  it("renders the current RoomScreen when the active session matches the URL", () => {
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
        name: "Danilo",
        role: "ADM",
        createdAt: "2026-07-20T12:00:00.000Z",
      },
      isJoined: true,
      isHydrated: true,
    });

    render(<RoomRouteGate roomCode="ABC-234-K9X" />);

    expect(screen.getByText("Sala liberada")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
