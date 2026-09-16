import { describe, expect, it, vi } from "vitest";
import type { SpeechAck } from "@/core/@types/server-speech";
import { StreamingSpeechClient } from "./client";

const sessionId = "550e8400-e29b-41d4-a716-446655440000";
const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
describe("StreamingSpeechClient", () => {
  it("orders start, PCM chunks and finish without sending duplicate text", async () => {
    const request = vi.fn().mockResolvedValue({ result: "ok", sessionId });
    const error = vi.fn();
    const client = new StreamingSpeechClient("room", error, request);
    await client.ready();
    client.start();
    client.chunk(new Float32Array([-1, 0, 1]));
    client.finish();
    await flush();
    expect(request.mock.calls.map(([event]) => event)).toEqual([
      "speech_ready",
      "speech_start",
      "speech_chunk",
      "speech_finish",
    ]);
    expect(request.mock.calls[2][1]).toEqual({
      sessionId,
      sequence: 0,
      audio: new Uint8Array([0, 128, 0, 0, 255, 127]),
    });
    expect(request.mock.calls[3][1]).toEqual({ sessionId, lastSequence: 0 });
    expect(error).not.toHaveBeenCalled();
  });

  it("cancels a session acknowledged after mute without sending audio", async () => {
    let resolve!: (value: SpeechAck) => void;
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<SpeechAck>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValue({ result: "ok" });
    const client = new StreamingSpeechClient("room", vi.fn(), request);
    client.start();
    client.chunk(new Float32Array(2048));
    client.stop();
    resolve({ result: "ok", sessionId });
    await flush();
    expect(request.mock.calls.map(([event]) => event)).toEqual([
      "speech_start",
      "speech_cancel",
      "speech_cancel",
    ]);
  });

  it("bounds audio queued behind a slow connection", () => {
    const request = vi.fn().mockReturnValue(new Promise(() => undefined));
    const error = vi.fn();
    const client = new StreamingSpeechClient("room", error, request);
    client.start();
    for (let i = 0; i < 25; i++) client.chunk(new Float32Array(2048));
    expect(error).toHaveBeenCalledExactlyOnceWith("STT_BACKPRESSURE");
  });
});
