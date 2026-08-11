import { describe, expect, it, vi } from "vitest";

import {
  requestLocalMedia,
  setMediaTrackEnabled,
  stopMediaStream,
} from "./media-service";

function createTrack(kind: "audio" | "video") {
  return {
    enabled: true,
    kind,
    stopped: false,
    stop() {
      this.stopped = true;
    },
  };
}

function createStream() {
  const audioTrack = createTrack("audio");
  const videoTrack = createTrack("video");
  const stream = {
    getTracks: () => [audioTrack, videoTrack],
    getAudioTracks: () => [audioTrack],
    getVideoTracks: () => [videoTrack],
  } as unknown as MediaStream;

  return { stream, audioTrack, videoTrack };
}

describe("media-service", () => {
  it("desativa microfone e câmera sem destruir o stream", () => {
    const { stream, audioTrack, videoTrack } = createStream();

    expect(
      setMediaTrackEnabled({ stream, kind: "audio", enabled: false }),
    ).toBe(true);
    expect(audioTrack.enabled).toBe(false);
    expect(videoTrack.enabled).toBe(true);
    expect(audioTrack.stopped).toBe(false);

    expect(
      setMediaTrackEnabled({ stream, kind: "video", enabled: false }),
    ).toBe(true);
    expect(videoTrack.enabled).toBe(false);
    expect(videoTrack.stopped).toBe(false);
  });

  it("para todas as tracks durante a limpeza da chamada", () => {
    const { stream, audioTrack, videoTrack } = createStream();

    stopMediaStream({ stream });

    expect(audioTrack.stopped).toBe(true);
    expect(videoTrack.stopped).toBe(true);
  });

  it("solicita mídia com as constraints informadas", async () => {
    const { stream } = createStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const constraints = { audio: true, video: false };

    await expect(requestLocalMedia({ constraints })).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(constraints);
  });
});
