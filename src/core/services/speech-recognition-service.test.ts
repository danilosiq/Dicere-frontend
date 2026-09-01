import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyPolyfill: vi.fn(),
  emit: vi.fn(),
  socket: {
    connected: true,
    emit: vi.fn(),
  },
}));

vi.mock("react-speech-recognition", () => ({
  default: {
    applyPolyfill: mocks.applyPolyfill,
  },
}));

vi.mock("@/core/services/socket-service", () => ({
  getSocket: () => mocks.socket,
}));

import {
  activateOnDeviceSpeechRecognition,
  reportSpeechRecognitionDiagnostic,
  restoreRemoteSpeechRecognition,
} from "@/core/services/speech-recognition-service";

describe("speech-recognition-service", () => {
  beforeEach(() => {
    mocks.applyPolyfill.mockReset();
    mocks.socket.connected = true;
    mocks.socket.emit.mockReset();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    Reflect.deleteProperty(window, "SpeechRecognition");
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

  it("ativa o reconhecedor local quando o pacote de idioma já existe", async () => {
    class NativeRecognition {
      static available = vi.fn().mockResolvedValue("available");
      static install = vi.fn();
      processLocally = false;
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: NativeRecognition,
    });

    await expect(activateOnDeviceSpeechRecognition("pt-BR")).resolves.toEqual({
      status: "activated",
    });

    expect(NativeRecognition.available).toHaveBeenCalledWith({
      langs: ["pt-BR"],
      processLocally: true,
    });
    const LocalRecognition = mocks.applyPolyfill.mock.calls[0]?.[0];
    expect(new LocalRecognition().processLocally).toBe(true);
  });

  it("instala o pacote disponível antes de ativar o modo local", async () => {
    class NativeRecognition {
      static available = vi.fn().mockResolvedValue("downloadable");
      static install = vi.fn().mockResolvedValue(true);
      processLocally = false;
    }
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: NativeRecognition,
    });

    await expect(activateOnDeviceSpeechRecognition("pt-BR")).resolves.toEqual({
      status: "activated",
    });
    expect(NativeRecognition.install).toHaveBeenCalledWith({
      langs: ["pt-BR"],
      processLocally: true,
    });
  });

  it("preserva o modo remoto quando a API local não está disponível", async () => {
    class NativeRecognition {}
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: NativeRecognition,
    });

    await expect(activateOnDeviceSpeechRecognition("pt-BR")).resolves.toEqual({
      status: "unsupported",
    });
    expect(mocks.applyPolyfill).not.toHaveBeenCalled();
  });

  it("restaura explicitamente o construtor remoto do navegador", () => {
    class NativeRecognition {}
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: NativeRecognition,
    });

    expect(restoreRemoteSpeechRecognition()).toBe(true);
    expect(mocks.applyPolyfill).toHaveBeenCalledWith(NativeRecognition);
  });
});
