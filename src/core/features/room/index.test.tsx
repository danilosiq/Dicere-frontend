import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoomScreen } from "@/core/features/room";
import { useRoomSessionStore } from "@/core/store/room-session-store";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  callSession: {
    microphoneEnabled: true,
    cameraEnabled: true,
    hasMicrophone: true,
    hasCamera: true,
    isLeaving: false,
    termination: null as
      | { type: "local-participant-removed" }
      | { type: "room-expired"; payload: { roomId: string; status: "EXPIRED" } }
      | null,
    leaveCall: vi.fn(),
    toggleMicrophone: vi.fn(),
    toggleCamera: vi.fn(),
  },
}));

vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "", variable: "" }),
  Roboto: () => ({ className: "", variable: "" }),
}));

vi.mock("@/core/components/logo", () => ({
  Logo: () => <div>Dicere</div>,
}));

vi.mock("@/core/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Tema</button>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "ABC-234-K9X" }),
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/core/hooks/use-call-session", () => ({
  useCallSession: () => mocks.callSession,
}));

vi.mock("@/core/features/room/components/video/video-section", () => ({
  VideoSection: () => <div>Vídeo</div>,
}));

vi.mock("@/core/features/room/components/chat/chat-section", () => ({
  ChatSection: () => <div>Chat</div>,
}));

describe("RoomScreen call tools", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.callSession.leaveCall.mockReset();
    mocks.callSession.toggleMicrophone.mockReset();
    mocks.callSession.toggleCamera.mockReset();
    mocks.callSession.termination = null;
    window.sessionStorage.setItem("dicere-room-session", "stored-session");
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
        createdAt: "2026-07-21T12:00:00.000Z",
      },
      resumeSession: {
        roomId: "room-id",
        roomCode: "ABC-234-K9X",
        roomTitle: "Daily",
        roomStatus: "ACTIVE",
        participantId: "participant-id",
        nickname: "Danilo",
        role: "ADM",
      },
      isJoined: true,
      isHydrated: true,
    });
  });

  it("connects microphone and camera buttons to the active call session", () => {
    render(<RoomScreen />);

    fireEvent.click(
      screen.getByRole("button", { name: "Desativar microfone" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Desativar câmera" }));

    expect(mocks.callSession.toggleMicrophone).toHaveBeenCalledOnce();
    expect(mocks.callSession.toggleCamera).toHaveBeenCalledOnce();
  });

  it("leaves the call, clears the resumable room session and returns Home", () => {
    render(<RoomScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Sair da chamada" }));

    expect(mocks.callSession.leaveCall).toHaveBeenCalledOnce();
    expect(useRoomSessionStore.getState().isJoined).toBe(false);
    expect(useRoomSessionStore.getState().resumeSession).toBeNull();
    expect(window.sessionStorage.getItem("dicere-room-session")).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith("/");
  });

  it("clears the room session and returns Home when the room expires", async () => {
    const view = render(<RoomScreen />);

    mocks.callSession.termination = {
      type: "room-expired",
      payload: { roomId: "room-id", status: "EXPIRED" },
    };
    view.rerender(<RoomScreen />);

    await vi.waitFor(() => {
      expect(useRoomSessionStore.getState().isJoined).toBe(false);
      expect(mocks.replace).toHaveBeenCalledWith("/");
    });
    expect(window.sessionStorage.getItem("dicere-room-session")).toBeNull();
  });
});
