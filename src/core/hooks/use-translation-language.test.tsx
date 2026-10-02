import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { setTranslationLanguage } from "@/core/services/translation-language-service";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { useTranslationLanguage } from "./use-translation-language";

vi.mock("@/core/services/translation-language-service", () => ({
  setTranslationLanguage: vi.fn(),
}));
const roomId = "550e8400-e29b-41d4-a716-446655440000";
const participantId = "550e8400-e29b-41d4-a716-446655440001";
beforeEach(() => {
  vi.mocked(setTranslationLanguage).mockReset();
  useRoomSessionStore.getState().clearSession();
  useRoomSessionStore.setState({
    room: {
      id: roomId,
      code: "ABC-234-K9X",
      title: "Daily",
      status: "ACTIVE",
      participants: [],
    },
    participant: {
      id: participantId,
      roomId,
      name: "Maria",
      role: "GUEST",
      createdAt: "2026-10-02T12:00:00Z",
      targetLanguage: "PT-BR",
    },
    spokenLanguage: "ES",
  });
});
it("changes the destination only after confirmation and preserves spoken language", async () => {
  vi.mocked(setTranslationLanguage).mockResolvedValue({
    result: "ok",
    roomId,
    participantId,
    targetLanguage: "EN",
  });
  const { result } = renderHook(() =>
    useTranslationLanguage(roomId, participantId),
  );
  await act(() => result.current.changeLanguage("EN"));
  expect(useRoomSessionStore.getState().participant?.targetLanguage).toBe("EN");
  expect(useRoomSessionStore.getState().spokenLanguage).toBe("ES");
  expect(result.current.isUpdating).toBe(false);
});
it("preserves the preference on failure and allows retry", async () => {
  vi.mocked(setTranslationLanguage).mockRejectedValueOnce(
    new Error("Não foi possível confirmar"),
  );
  const { result } = renderHook(() =>
    useTranslationLanguage(roomId, participantId),
  );
  await act(() => result.current.changeLanguage("EN"));
  expect(result.current.error).toBe("Não foi possível confirmar");
  expect(useRoomSessionStore.getState().participant?.targetLanguage).toBe(
    "PT-BR",
  );
  vi.mocked(setTranslationLanguage).mockResolvedValue({
    result: "ok",
    roomId,
    participantId,
    targetLanguage: "EN",
  });
  await act(() => result.current.changeLanguage("EN"));
  expect(result.current.error).toBeUndefined();
});
it("ignores another participant confirmation", async () => {
  vi.mocked(setTranslationLanguage).mockResolvedValue({
    result: "ok",
    roomId,
    participantId: roomId,
    targetLanguage: "EN",
  });
  const { result } = renderHook(() =>
    useTranslationLanguage(roomId, participantId),
  );
  await act(() => result.current.changeLanguage("EN"));
  expect(result.current.error).toMatch(/outra sessão/);
  expect(useRoomSessionStore.getState().participant?.targetLanguage).toBe(
    "PT-BR",
  );
});
it("prevents overlapping requests and ignores late confirmation after room change", async () => {
  let confirm!: (
    value: Awaited<ReturnType<typeof setTranslationLanguage>>,
  ) => void;
  vi.mocked(setTranslationLanguage).mockReturnValue(
    new Promise((resolve) => {
      confirm = resolve;
    }),
  );
  const { result, rerender } = renderHook(
    ({ id }) => useTranslationLanguage(id, participantId),
    { initialProps: { id: roomId } },
  );
  act(() => {
    void result.current.changeLanguage("EN");
    void result.current.changeLanguage("ES");
  });
  expect(setTranslationLanguage).toHaveBeenCalledTimes(1);
  expect(result.current.isUpdating).toBe(true);
  rerender({ id: "other-room" });
  await act(async () =>
    confirm({ result: "ok", roomId, participantId, targetLanguage: "EN" }),
  );
  await waitFor(() => expect(result.current.isUpdating).toBe(false));
  expect(useRoomSessionStore.getState().participant?.targetLanguage).toBe(
    "PT-BR",
  );
});
