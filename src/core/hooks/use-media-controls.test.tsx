import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useMediaControls } from "@/core/hooks/use-media-controls";
import { useCallStore } from "@/core/store/call-store";
import { MockMediaStream, MockMediaStreamTrack } from "@/test/webrtc-mocks";

describe("useMediaControls", () => {
  beforeEach(() => {
    useCallStore.getState().resetCallState();
  });

  it("mutes and restores every local audio track", () => {
    const audioTrack = new MockMediaStreamTrack("audio");
    const stream = new MockMediaStream([audioTrack]);
    useCallStore.getState().setLocalStream(stream as unknown as MediaStream);
    const { result } = renderHook(() => useMediaControls());

    act(() => result.current.toggleMicrophone());

    expect(audioTrack.enabled).toBe(false);
    expect(useCallStore.getState().microphoneEnabled).toBe(false);

    act(() => result.current.toggleMicrophone());

    expect(audioTrack.enabled).toBe(true);
    expect(useCallStore.getState().microphoneEnabled).toBe(true);
  });

  it("disables and restores every local video track", () => {
    const videoTrack = new MockMediaStreamTrack("video");
    const stream = new MockMediaStream([videoTrack]);
    useCallStore.getState().setLocalStream(stream as unknown as MediaStream);
    const { result } = renderHook(() => useMediaControls());

    act(() => result.current.toggleCamera());

    expect(videoTrack.enabled).toBe(false);
    expect(useCallStore.getState().cameraEnabled).toBe(false);

    act(() => result.current.toggleCamera());

    expect(videoTrack.enabled).toBe(true);
    expect(useCallStore.getState().cameraEnabled).toBe(true);
  });
});
