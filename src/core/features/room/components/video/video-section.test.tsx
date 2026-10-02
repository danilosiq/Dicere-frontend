import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallSession } from "@/core/hooks/use-call-session";
import { DEEPL_TARGET_LANGUAGES } from "@/core/components/selector-country/countryList";
import type { DeepLTargetLanguage } from "@/core/components";
const mocks = vi.hoisted(() => ({
  speech: vi.fn(),
  subtitle: vi.fn(),
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
vi.mock("./subtitle-camp", () => ({
  SubtitleCamp: (props: unknown) => {
    mocks.subtitle(props);
    return null;
  },
}));
import { VideoSection } from "./video-section";
const call = { microphoneEnabled: true, isLeaving: false } as CallSession;

beforeEach(() => {
  mocks.room = { id: "room-1", participants: [] };
  mocks.subtitle.mockReset();
  mocks.speech.mockReturnValue({
    captionIssue: null,
    translations: [],
    retryRecognition: vi.fn(),
  });
});
afterEach(() => vi.unstubAllEnvs());
describe("server speech privacy gate", () => {
  it("cancels the speech room immediately when leaving, rather than draining mute", () => {
    render(<VideoSection call={{ ...call, isLeaving: true }} />);
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ roomId: undefined, enabled: false }),
    );
  });

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

  it.each(DEEPL_TARGET_LANGUAGES)(
    "enables voice for the selected language %s",
    (language) => {
      const view = render(<VideoSection call={call} />);
      const subtitleProps = mocks.subtitle.mock.calls.at(-1)?.[0] as {
        onLanguageChange: (language: DeepLTargetLanguage) => void;
      };

      act(() => subtitleProps.onLanguageChange(language));
      view.rerender(<VideoSection call={call} />);

      expect(mocks.speech).toHaveBeenLastCalledWith(
        expect.objectContaining({ enabled: true, language }),
      );
      expect(mocks.subtitle.mock.calls.at(-1)?.[0]).toMatchObject({
        captionIssue: null,
      });
    },
  );

  it("uses local multilingual capture in a pilot and requires consent again for PT-BR", () => {
    const pilot = "550e8400-e29b-41d4-a716-446655440000";
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS", pilot);
    mocks.room = { id: pilot, participants: [] };
    render(<VideoSection call={call} />);
    expect(screen.getByLabelText("Privacidade da transcrição")).toBeTruthy();
    act(() => mocks.subtitle.mock.calls.at(-1)?.[0].onLanguageChange("EN"));
    expect(screen.queryByLabelText("Privacidade da transcrição")).toBeNull();
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ language: "EN", enabled: true }),
    );
    act(() => mocks.subtitle.mock.calls.at(-1)?.[0].onLanguageChange("PT-BR"));
    expect(screen.getByLabelText("Privacidade da transcrição")).toBeTruthy();
    expect(mocks.speech).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
  });
  it("keeps capture off until consent and asks again for another room", () => {
    const firstPilot = "550e8400-e29b-41d4-a716-446655440000";
    const secondPilot = "550e8400-e29b-41d4-a716-446655440001";
    vi.stubEnv(
      "NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS",
      `${firstPilot},${secondPilot}`,
    );
    mocks.room = { id: firstPilot, participants: [] };
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
    mocks.room = { id: secondPilot, participants: [] };
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
