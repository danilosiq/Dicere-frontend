import assert from "node:assert/strict";
import test from "node:test";

import { setMediaTrackEnabled, stopMediaStream } from "./media-service.ts";

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

test("desativa microfone e câmera sem destruir o stream", () => {
  const { stream, audioTrack, videoTrack } = createStream();

  assert.equal(
    setMediaTrackEnabled({ stream, kind: "audio", enabled: false }),
    true,
  );
  assert.equal(audioTrack.enabled, false);
  assert.equal(videoTrack.enabled, true);
  assert.equal(audioTrack.stopped, false);

  assert.equal(
    setMediaTrackEnabled({ stream, kind: "video", enabled: false }),
    true,
  );
  assert.equal(videoTrack.enabled, false);
  assert.equal(videoTrack.stopped, false);
});

test("para todas as tracks durante a limpeza da chamada", () => {
  const { stream, audioTrack, videoTrack } = createStream();

  stopMediaStream({ stream });

  assert.equal(audioTrack.stopped, true);
  assert.equal(videoTrack.stopped, true);
});
