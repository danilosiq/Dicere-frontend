import { beforeEach, it, expect, vi } from "vitest";
import { getSocket } from "./socket-service";
import { setTranslationLanguage } from "./translation-language-service";
vi.mock("./socket-service", () => ({ getSocket: vi.fn() }));
const emit = vi.fn();
beforeEach(() => {
  emit.mockReset();
  vi.mocked(getSocket).mockReturnValue({
    connected: true,
    timeout: () => ({ emitWithAck: emit }),
  } as unknown as ReturnType<typeof getSocket>);
});
it("sends only target language and validates confirmed identity", async () => {
  emit.mockResolvedValue({
    result: "ok",
    roomId: "550e8400-e29b-41d4-a716-446655440000",
    participantId: "550e8400-e29b-41d4-a716-446655440001",
    targetLanguage: "ES",
  });
  await expect(setTranslationLanguage("ES")).resolves.toMatchObject({
    targetLanguage: "ES",
  });
  expect(emit).toHaveBeenCalledWith("set_translation_language", {
    targetLanguage: "ES",
  });
});
it.each([
  { result: "ok", targetLanguage: "EN" },
  { result: "error", code: "LANGUAGE_FORBIDDEN" },
  null,
])("rejects malformed or failed confirmation %j", async (response) => {
  emit.mockResolvedValue(response);
  await expect(setTranslationLanguage("ES")).rejects.toThrow();
});
it("does not retry timeout or send after disconnection", async () => {
  emit.mockRejectedValue(new Error("timeout"));
  await expect(setTranslationLanguage("ES")).rejects.toThrow();
  expect(emit).toHaveBeenCalledTimes(1);
  vi.mocked(getSocket).mockReturnValue({ connected: false } as ReturnType<
    typeof getSocket
  >);
  await expect(setTranslationLanguage("ES")).rejects.toThrow();
  expect(emit).toHaveBeenCalledTimes(1);
});
