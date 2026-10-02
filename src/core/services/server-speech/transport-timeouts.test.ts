import { describe, expect, it, vi } from "vitest";
const socket = vi.hoisted(() => ({
  connected: true,
  timeout: vi.fn(),
  emitWithAck: vi.fn(),
}));
vi.mock("../socket-service", () => ({ getSocket: () => socket }));
import { requestSpeech } from "./transport";

describe("bounded multilingual processing acknowledgments", () => {
  it("waits beyond the server deadline without changing capture readiness waits", async () => {
    socket.timeout.mockReturnValue(socket);
    socket.emitWithAck.mockResolvedValue({ result: "ok" });
    await requestSpeech("speech_finish", {
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      lastSequence: 0,
    });
    expect(socket.timeout).toHaveBeenLastCalledWith(5500);
    await requestSpeech("speech_cancel", {});
    expect(socket.timeout).toHaveBeenLastCalledWith(1500);
  });
});
