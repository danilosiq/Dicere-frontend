import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emit: vi.fn(),
  socket: {
    connected: true,
    emit: vi.fn(),
  },
}));

vi.mock("@/core/services/socket-service", () => ({
  getSocket: () => mocks.socket,
}));

import { reportSpeechRecognitionDiagnostic } from "@/core/services/speech-recognition-service";

describe("speech-recognition-service", () => {
  beforeEach(() => {
    mocks.socket.connected = true;
    mocks.socket.emit.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("registra a causa local e envia somente diagnóstico técnico ao backend", async () => {
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });

    await reportSpeechRecognitionDiagnostic({
      code: "network",
      locale: "pt-BR",
      mode: "remote",
      retryAttempt: 2,
      stage: "runtime",
    });

    expect(console.warn).toHaveBeenCalledWith(
      "[Dicere][SpeechRecognition]",
      expect.objectContaining({
        code: "network",
        locale: "pt-BR",
        online: false,
        reason: "OFFLINE",
        retryAttempt: 2,
      }),
    );
    expect(mocks.socket.emit).toHaveBeenCalledWith(
      "speech_recognition_diagnostic",
      expect.objectContaining({
        code: "network",
        online: false,
        reason: "OFFLINE",
      }),
    );
    expect(mocks.socket.emit.mock.calls[0]?.[1]).not.toHaveProperty("roomId");
    expect(mocks.socket.emit.mock.calls[0]?.[1]).not.toHaveProperty("text");
  });

  it("mantém o log local quando o socket está desconectado", async () => {
    mocks.socket.connected = false;

    await expect(
      reportSpeechRecognitionDiagnostic({
        code: "start-failed",
        errorName: "InvalidStateError",
        locale: "pt-BR",
        mode: "remote",
        retryAttempt: 1,
        stage: "start",
      }),
    ).resolves.toBeUndefined();

    expect(console.error).toHaveBeenCalled();
    expect(mocks.socket.emit).not.toHaveBeenCalled();
  });
});
