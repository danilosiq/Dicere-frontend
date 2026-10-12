import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useCallStore } from "@/core/store/call-store";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import type { CallTermination } from "./use-webrtc-signaling";

const mocks = vi.hoisted(() => ({
  stop: vi.fn(),
  start: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
  join: vi.fn(),
  termination: undefined as undefined | ((event: CallTermination) => void),
}));
vi.mock("@/core/services/call-signaling-service", () => ({
  leaveCall: vi.fn(),
  resetCallSignaling: vi.fn(),
  resetParticipantReady: vi.fn(),
}));
vi.mock("./use-local-media", () => ({
  useLocalMedia: () => ({
    localStream: useCallStore.getState().localStream,
    startLocalMedia: mocks.start,
    stopLocalMedia: mocks.stop,
    isRequesting: false,
    isError: false,
    errorMessage: null,
  }),
}));
vi.mock("./use-peer-connection", () => ({
  usePeerConnection: () => ({
    peerConnection: null,
    remoteStream: null,
    connectionState: null,
    createPeerConnection: mocks.create,
    closePeerConnection: mocks.close,
  }),
}));
vi.mock("./use-join-call", () => ({
  useJoinCall: () => ({
    joinCall: mocks.join,
    isJoined: false,
    isJoining: false,
    errorMessage: null,
    error: null,
  }),
}));
vi.mock("./use-participant-ready", () => ({
  useParticipantReady: () => ({
    isWaitingForParticipant: false,
    isError: false,
    errorMessage: null,
    retryParticipantReady: vi.fn(),
  }),
}));
vi.mock("./use-webrtc-signaling", () => ({
  useWebRtcSignaling: ({
    onCallTerminated,
  }: {
    onCallTerminated: typeof mocks.termination;
  }) => {
    mocks.termination = onCallTerminated;
    return {
      status: "idle",
      errorMessage: null,
      retryConnection: vi.fn().mockResolvedValue(undefined),
    };
  },
}));
import { useCallSession } from "./use-call-session";

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it("preserves media and mute preferences, then resumes only after room readmission", async () => {
  const stream = {
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  } as unknown as MediaStream;
  useCallStore.setState({
    localStream: stream,
    microphoneEnabled: false,
    cameraEnabled: false,
  });
  useRoomSessionStore.setState({ isJoined: true, isReconnecting: false });
  mocks.start.mockResolvedValue(stream);
  mocks.join.mockResolvedValue(undefined);
  const hook = renderHook(useCallSession);
  await act(async () => {});
  mocks.join.mockClear();
  mocks.close.mockClear();
  act(() => {
    useRoomSessionStore.getState().setReconnecting(true);
    mocks.termination!({ type: "socket-disconnected" });
  });
  expect(mocks.stop).not.toHaveBeenCalled();
  expect(useCallStore.getState().localStream).toBe(stream);
  expect(useCallStore.getState().microphoneEnabled).toBe(false);
  expect(useCallStore.getState().cameraEnabled).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60000);
  });
  expect(mocks.join).not.toHaveBeenCalled();
  act(() => useRoomSessionStore.getState().setReconnecting(false));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
  expect(mocks.join).toHaveBeenCalledOnce();
  hook.unmount();
});
