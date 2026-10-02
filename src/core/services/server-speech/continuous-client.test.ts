import type { SpeechEvent, SpeechPayload } from "@/core/@types/server-speech";
import { describe, expect, it, vi } from "vitest";
import { StreamingSpeechClient } from "./client";
import { StreamingSegmenter } from "./segmenter";
import type { requestSpeech } from "./transport";

describe("continuous segmenter and transport", () => {
  it("uploads bounded windows for 31 seconds and finalizes them in order", async () => {
    const uploads: number[][] = [];
    const finishes: string[] = [];
    const request = vi.fn(
      async (
        event: SpeechEvent,
        payload: SpeechPayload,
      ): ReturnType<typeof requestSpeech> => {
        if (event === "speech_start") {
          uploads.push([]);
          return { result: "ok", sessionId: `${uploads.length}` };
        }
        if (event === "speech_chunk" && "audio" in payload) {
          const chunks = uploads[Number(payload.sessionId) - 1];
          expect(payload.sequence).toBe(chunks.length);
          chunks.push(payload.audio.length);
        }
        if (event === "speech_finish" && "lastSequence" in payload) {
          finishes.push(payload.sessionId);
          expect(payload.lastSequence).toBe(
            uploads[Number(payload.sessionId) - 1].length - 1,
          );
        }
        return { result: "ok" };
      },
    );
    const onError = vi.fn();
    const client = new StreamingSpeechClient("room", onError, request, "es-ES");
    const segmenter = new StreamingSegmenter({
      start: () => client.start(),
      chunk: (frame) => client.chunk(frame),
      finish: () => client.finish(),
    });
    for (let packet = 0; packet < 250; packet++) {
      const frame = new Float32Array(2048);
      for (let index = 0; index < frame.length; index++)
        if (packet * 2048 + index < 31 * 16000) frame[index] = 0.1;
      segmenter.push(frame);
      // Model the real 128 ms packets without waiting on a wall clock.
      for (let turn = 0; turn < 16; turn++) await Promise.resolve();
    }
    expect(onError).not.toHaveBeenCalled();
    expect(finishes).toEqual(["1", "2", "3"]);
    expect(
      uploads.map((chunks) => chunks.reduce((sum, bytes) => sum + bytes, 0)),
    ).toEqual([384000, 384000, expect.any(Number)]);
    expect(uploads[2].reduce((sum, bytes) => sum + bytes, 0)).toBeGreaterThan(
      7 * 32000,
    );
    expect(
      request.mock.calls
        .filter(([event]) => event === "speech_start")
        .every(
          ([, payload]) => "locale" in payload && payload.locale === "es-ES",
        ),
    ).toBe(true);
    client.stop();
    expect(request.mock.calls.at(-1)).toEqual(["speech_cancel", {}]);
  });
});
