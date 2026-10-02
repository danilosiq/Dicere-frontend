import { afterEach, expect, it, vi } from "vitest";
import { StreamingSpeechClient } from "./client";
import { isServerSpeechEnabled } from "./config";
afterEach(() => vi.unstubAllEnvs());
it.each(["pt-BR", "en-US", "es-ES", "de-DE", "zh-CN"] as const)(
  "prepares and captures %s without rewriting the source",
  async (locale) => {
    const request = vi
      .fn()
      .mockResolvedValue({ result: "ok", sessionId: "session" });
    const client = new StreamingSpeechClient("room", vi.fn(), request, locale);
    await client.ready();
    client.start();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    for (const [, payload] of request.mock.calls)
      expect(payload.locale).toBe(locale);
    client.stop();
  },
);
it.each(["PT-BR", "EN", "ES", "DE", "ZH-HANS"] as const)(
  "enables the released %s server engine",
  (language) => {
    vi.stubEnv("NEXT_PUBLIC_SPEECH_SERVER_ENABLED", "true");
    expect(
      isServerSpeechEnabled("550e8400-e29b-41d4-a716-446655440000", language),
    ).toBe(true);
  },
);
