import { create } from "zustand";

import type {
  CallJoinedPayload,
  CallReadyPayload,
  WaitingForParticipantPayload,
} from "@/core/@types/socket-events";

type CallStore = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  joinedCall: CallJoinedPayload | null;
  waitingForParticipant: WaitingForParticipantPayload | null;
  callReady: CallReadyPayload | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  iceGatheringState: RTCIceGatheringState | null;
  signalingState: RTCSignalingState | null;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  setLocalStream: (stream: MediaStream) => void;
  setRemoteStream: (stream: MediaStream) => void;
  setJoinedCall: (joinedCall: CallJoinedPayload) => void;
  setWaitingForParticipant: (
    waitingForParticipant: WaitingForParticipantPayload,
  ) => void;
  setCallReady: (callReady: CallReadyPayload) => void;
  setPeerConnectionStates: (states: PeerConnectionStates) => void;
  setMicrophoneEnabled: (enabled: boolean) => void;
  setCameraEnabled: (enabled: boolean) => void;
  clearLocalStream: (expectedStream?: MediaStream) => void;
  clearRemoteStream: (expectedStream?: MediaStream) => void;
  clearJoinedCall: () => void;
  clearParticipantReadiness: () => void;
  clearPeerConnectionStates: () => void;
  resetCallState: () => void;
};

export type PeerConnectionStates = {
  connectionState: RTCPeerConnectionState;
  iceConnectionState: RTCIceConnectionState;
  iceGatheringState: RTCIceGatheringState;
  signalingState: RTCSignalingState;
};

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  remoteStream: null,
  joinedCall: null,
  waitingForParticipant: null,
  callReady: null,
  connectionState: null,
  iceConnectionState: null,
  iceGatheringState: null,
  signalingState: null,
  microphoneEnabled: true,
  cameraEnabled: true,
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setJoinedCall: (joinedCall) =>
    set((state) => {
      const isSameCall =
        state.joinedCall?.roomId === joinedCall.roomId &&
        state.joinedCall.participantId === joinedCall.participantId;

      if (isSameCall) {
        return { joinedCall };
      }

      return {
        joinedCall,
        waitingForParticipant: null,
        callReady: null,
      };
    }),
  setWaitingForParticipant: (waitingForParticipant) =>
    set({ waitingForParticipant, callReady: null }),
  setCallReady: (callReady) => set({ callReady, waitingForParticipant: null }),
  setPeerConnectionStates: (states) => set(states),
  setMicrophoneEnabled: (microphoneEnabled) => set({ microphoneEnabled }),
  setCameraEnabled: (cameraEnabled) => set({ cameraEnabled }),
  clearLocalStream: (expectedStream) =>
    set((state) => {
      if (expectedStream && state.localStream !== expectedStream) {
        return state;
      }

      return { localStream: null };
    }),
  clearRemoteStream: (expectedStream) =>
    set((state) => {
      if (expectedStream && state.remoteStream !== expectedStream) {
        return state;
      }

      return { remoteStream: null };
    }),
  clearJoinedCall: () =>
    set({
      joinedCall: null,
      waitingForParticipant: null,
      callReady: null,
    }),
  clearParticipantReadiness: () =>
    set({ waitingForParticipant: null, callReady: null }),
  clearPeerConnectionStates: () =>
    set({
      connectionState: null,
      iceConnectionState: null,
      iceGatheringState: null,
      signalingState: null,
    }),
  resetCallState: () =>
    set({
      localStream: null,
      remoteStream: null,
      joinedCall: null,
      waitingForParticipant: null,
      callReady: null,
      connectionState: null,
      iceConnectionState: null,
      iceGatheringState: null,
      signalingState: null,
      microphoneEnabled: true,
      cameraEnabled: true,
    }),
}));
