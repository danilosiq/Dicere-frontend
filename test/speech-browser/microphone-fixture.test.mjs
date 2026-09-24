import { afterEach, expect, it, vi } from "vitest";
import { installMicrophoneFixture } from "./microphone-fixture.mjs";

afterEach(() => {
  vi.unstubAllGlobals();
  delete window.dicereFixture;
  delete window.disposeDicereFixture;
  delete window.playDicereFixture;
});

it("stops native camera streams acquired by the test's WebRTC clients", async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] };
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockResolvedValue(stream) },
  });
  installMicrophoneFixture();
  expect(
    await navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
  ).toBe(stream);
  await window.disposeDicereFixture();
  await window.disposeDicereFixture();
  expect(stop).toHaveBeenCalledOnce();
});

it("stops a pending native stream if it arrives after disposal", async () => {
  const stop = vi.fn();
  let resolve;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((done) => {
          resolve = done;
        }),
    },
  });
  installMicrophoneFixture();
  const pending = navigator.mediaDevices.getUserMedia({ video: true });
  await window.disposeDicereFixture();
  resolve({ getTracks: () => [{ stop }] });
  await pending;
  expect(stop).toHaveBeenCalledOnce();
});

it("disposes every synthetic context, track and source, including replaced fixtures", async () => {
  const contexts = [];
  const native = vi.fn().mockResolvedValue("native-stream");
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: native } });
  vi.stubGlobal(
    "AudioContext",
    class {
      constructor() {
        this.currentTime = 0;
        this.baseLatency = 0;
        this.resume = vi.fn().mockResolvedValue(undefined);
        this.close = vi.fn().mockResolvedValue(undefined);
        this.track = { stop: vi.fn() };
        this.destination = {
          stream: { getTracks: () => [this.track] },
          disconnect: vi.fn(),
        };
        this.source = {
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
        };
        contexts.push(this);
      }
      createMediaStreamDestination() {
        return this.destination;
      }
      createBuffer() {
        return { duration: 1, getChannelData: () => new Float32Array(1) };
      }
      createBufferSource() {
        return this.source;
      }
    },
  );
  installMicrophoneFixture();
  for (let i = 0; i < 2; i++) {
    await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    window.playDicereFixture("AAA=");
  }
  // Finished sources release their graph edge before global disposal.
  contexts[0].source.onended();
  expect(contexts[0].source.disconnect).toHaveBeenCalledOnce();
  await window.disposeDicereFixture();
  await window.disposeDicereFixture();
  for (const context of contexts) {
    expect(context.close).toHaveBeenCalledOnce();
    expect(context.track.stop).toHaveBeenCalledOnce();
    expect(context.destination.disconnect).toHaveBeenCalledOnce();
  }
  expect(contexts[1].source.stop).toHaveBeenCalledOnce();
  expect(contexts[1].source.disconnect).toHaveBeenCalledOnce();
  expect(window.dicereFixture).toBeUndefined();
  expect(await navigator.mediaDevices.getUserMedia({ audio: true })).toBe(
    "native-stream",
  );
});
