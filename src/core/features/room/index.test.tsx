import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoomScreen } from "@/core/features/room";
import { useRoomSessionStore } from "@/core/store/room-session-store";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  writeText: vi.fn(),
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
  afterEach(() => vi.unstubAllGlobals());

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    mocks.replace.mockReset();
    mocks.writeText.mockReset();
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
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it("copies the room link including its code and shows the confirmation tooltip", async () => {
    mocks.writeText.mockResolvedValue(undefined);
    render(<RoomScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));

    await vi.waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(
        `${window.location.origin}/room/ABC-234-K9X`,
      );
    });
    expect((await screen.findByRole("tooltip")).textContent).toBe("Copiado!");
    expect(screen.getByRole("button", { name: "Compartilhar" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "ABC-234-K9X" })).toBeNull();
    await vi.waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull(), {
      timeout: 3_000,
    });
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    expect((await screen.findByRole("tooltip")).textContent).toBe("Copiado!");
    expect(mocks.writeText).toHaveBeenCalledTimes(2);
  });

  it("shows an error state when the room link cannot be copied", async () => {
    mocks.writeText.mockRejectedValue(new Error("Clipboard unavailable"));
    render(<RoomScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));

    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Não foi possível copiar",
    );
    expect(screen.queryByText("Copiado!")).toBeNull();
  });

  it("does not show success when the clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    render(<RoomScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar" }));
    expect((await screen.findByRole("tooltip")).textContent).toBe(
      "Não foi possível copiar",
    );
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("waits for the clipboard before confirming and prevents duplicate clicks", async () => {
    let complete!: () => void;
    mocks.writeText.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        }),
    );
    render(<RoomScreen />);
    const button = screen.getByRole("button", { name: "Compartilhar" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocks.writeText).toHaveBeenCalledOnce();
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("tooltip")).toBeNull();
    complete();
    expect((await screen.findByRole("tooltip")).textContent).toBe("Copiado!");
    expect((button as HTMLButtonElement).disabled).toBe(false);
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
