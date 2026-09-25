import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallSession } from "@/core/hooks/use-call-session";
const mocks = vi.hoisted(() => ({
  speech: vi.fn(),
  room: { id: "room-1", participants: [] },
}));
vi.mock("next/font/google", () => ({
  Baloo_2: () => ({ className: "" }),
  Roboto: () => ({ className: "" }),
}));
vi.mock("@/core/hooks/use-speech-translation", () => ({
  useSpeechTranslation: mocks.speech,
}));
vi.mock("@/core/store/room-session-store", () => ({
  useRoomSessionStore: (select: (state: unknown) => unknown) =>
    select({ room: mocks.room }),
}));
vi.mock("@/core/components/media-stream-video", () => ({
  MediaStreamVideo: () => null,
}));
vi.mock("./subtitle-camp", () => ({ SubtitleCamp: () => null }));
import { VideoSection } from "./video-section";
const call = { microphoneEnabled: true, isLeaving: false } as CallSession;

beforeEach(() => {
  mocks.room = { id: "room-1", participants: [] };
  mocks.speech.mockReturnValue({
    captionIssue: null,
    translations: [],
    retryRecognition: vi.fn(),
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("server speech privacy gate", () => {
  it("requires consent in a pilot room and preserves other rooms", () => {
    const pilot = "550e8400-e29b-41d4-a716-446655440000";
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "false");
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", pilot);
    mocks.room = { id: pilot, participants: [] };
    const view = render(<VideoSection call={call} />);
    expect(screen.getByLabelText("Privacidade da transcrição")).toBeTruthy();
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ativar transcrição nesta sala" }),
    );
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    mocks.room = { id: "another-room", participants: [] };
    view.rerender(<VideoSection call={call} />);
    expect(screen.queryByLabelText("Privacidade da transcrição")).toBeNull();
  });
  it("keeps capture off until consent and asks again for another room", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "true");
    const view = render(<VideoSection call={call} />);
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.getByText(/DeepL/)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Ativar transcrição nesta sala" }),
    );
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
    mocks.room = { id: "room-2", participants: [] };
    view.rerender(<VideoSection call={call} />);
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(screen.getByLabelText("Privacidade da transcrição")).toBeTruthy();
  });
  it("does not change the legacy interface when the flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "false");
    render(<VideoSection call={call} />);
    expect(screen.queryByLabelText("Privacidade da transcrição")).toBeNull();
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });
});
