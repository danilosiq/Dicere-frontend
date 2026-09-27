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

  it("uploads the next utterance while finishing, but serializes finalizations", async () => {
    let complete!: (value: SpeechAck) => void;
    let starts = 0;
    const request = vi.fn().mockImplementation((event: string) => {
      if (event === "speech_start")
        return Promise.resolve({ result: "ok", sessionId: `${++starts}` });
      if (event === "speech_finish")
        return new Promise<SpeechAck>((resolve) => {
          complete = resolve;
        });
      return Promise.resolve({ result: "ok" });
    });
    const error = vi.fn();
    const client = new StreamingSpeechClient("room", error, request);
    client.start();
    client.chunk(new Float32Array([1]));
    client.finish();
    client.start();
    client.chunk(new Float32Array([0.5]));
    client.finish();
    await flush();
    expect(request.mock.calls.map(([event]) => event)).toEqual([
      "speech_start",
      "speech_chunk",
      "speech_finish",
      "speech_start",
      "speech_chunk",
    ]);
    complete({ result: "ok" });
    await flush();
    expect(request.mock.calls.at(-1)).toEqual([
      "speech_finish",
      { sessionId: "2", lastSequence: 0 },
    ]);
    complete({ result: "ok" });
    await flush();
    expect(error).not.toHaveBeenCalled();
  });

  it.each(["resolve", "reject"])(
    "cancels all owned sessions and ignores a late %s",
    async (settlement) => {
      let resolve!: (value: SpeechAck) => void;
      let reject!: (error: Error) => void;
      const request = vi.fn().mockImplementation((event: string) => {
        if (event === "speech_finish")
          return new Promise<SpeechAck>((done, fail) => {
            resolve = done;
            reject = fail;
          });
        return Promise.resolve({ result: "ok", sessionId });
      });
      const error = vi.fn();
      const client = new StreamingSpeechClient("room", error, request);
      client.start();
      client.chunk(new Float32Array([1]));
      client.finish();
      client.start();
      client.chunk(new Float32Array([1]));
      client.finish();
      await flush();
      client.stop();
      expect(request.mock.calls.at(-1)).toEqual(["speech_cancel", {}]);
      const calls = request.mock.calls.length;
      if (settlement === "resolve") resolve({ result: "ok" });
      else reject(new Error("STT_TIMEOUT"));
      await flush();
      expect(request).toHaveBeenCalledTimes(calls);
      expect(error).not.toHaveBeenCalled();
    },
  );

  it("discards the next capture if the previous inference fails", async () => {
    let reject!: (error: Error) => void;
    const request = vi.fn().mockImplementation((event: string) => {
      if (event === "speech_finish")
        return new Promise<SpeechAck>((_, fail) => {
          reject = fail;
        });
      return Promise.resolve({ result: "ok", sessionId });
    });
    const error = vi.fn();
    const client = new StreamingSpeechClient("room", error, request);
    client.start();
    client.chunk(new Float32Array([1]));
    client.finish();
    client.start();
    client.chunk(new Float32Array([1]));
    client.finish();
    await flush();
    reject(new Error("STT_TIMEOUT"));
    await flush();
    expect(error).toHaveBeenCalledExactlyOnceWith("STT_TIMEOUT");
    expect(
      request.mock.calls.filter(([event]) => event === "speech_finish"),
    ).toHaveLength(1);
    expect(request.mock.calls.at(-1)).toEqual(["speech_cancel", {}]);
  });
});
