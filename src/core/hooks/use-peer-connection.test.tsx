import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { usePeerConnection } from "@/core/hooks/use-peer-connection";
import { useCallStore } from "@/core/store/call-store";
import {
  installWebRtcGlobals,
  MockMediaStreamTrack,
  MockPeerConnection,
} from "@/test/webrtc-mocks";

describe("usePeerConnection", () => {
  beforeEach(() => {
    installWebRtcGlobals();
    useCallStore.getState().resetCallState();
  });

  it("publica o stream remoto novamente quando as faixas chegam separadas", () => {
    const { result } = renderHook(() => usePeerConnection());

    act(() => {
      result.current.createPeerConnection();
    });

    const peerConnection = MockPeerConnection.instances[0];
    const audioTrack = new MockMediaStreamTrack("audio", "remote-audio");
    const videoTrack = new MockMediaStreamTrack("video", "remote-video");

    act(() => {
      peerConnection.emitRemoteTrack(audioTrack);
    });

    const audioOnlyStream = result.current.remoteStream;
    expect(audioOnlyStream?.getTracks()).toHaveLength(1);

    act(() => {
      peerConnection.emitRemoteTrack(videoTrack);
    });

    expect(result.current.remoteStream).not.toBe(audioOnlyStream);
    expect(result.current.remoteStream?.getAudioTracks()).toHaveLength(1);
    expect(result.current.remoteStream?.getVideoTracks()).toHaveLength(1);
  });

  it("remove do stream uma faixa remota encerrada", () => {
    const { result } = renderHook(() => usePeerConnection());

    act(() => {
      result.current.createPeerConnection();
    });

    const peerConnection = MockPeerConnection.instances[0];
    const audioTrack = new MockMediaStreamTrack("audio", "remote-audio");
    const videoTrack = new MockMediaStreamTrack("video", "remote-video");

    act(() => {
      peerConnection.emitRemoteTrack(audioTrack);
      peerConnection.emitRemoteTrack(videoTrack);
      videoTrack.stop();
    });

    expect(result.current.remoteStream?.getAudioTracks()).toHaveLength(1);
    expect(result.current.remoteStream?.getVideoTracks()).toHaveLength(0);

    act(() => {
      audioTrack.stop();
    });

    expect(result.current.remoteStream).toBeNull();
  });
});
