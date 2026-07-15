import { create } from "zustand";

import type { CallJoinedPayload } from "@/core/@types/socket-events";

type CallStore = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  joinedCall: CallJoinedPayload | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  iceGatheringState: RTCIceGatheringState | null;
  signalingState: RTCSignalingState | null;
  setLocalStream: (stream: MediaStream) => void;
  setRemoteStream: (stream: MediaStream) => void;
  setJoinedCall: (joinedCall: CallJoinedPayload) => void;
  setPeerConnectionStates: (states: PeerConnectionStates) => void;
  clearLocalStream: (expectedStream?: MediaStream) => void;
  clearRemoteStream: (expectedStream?: MediaStream) => void;
  clearJoinedCall: () => void;
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
  connectionState: null,
  iceConnectionState: null,
  iceGatheringState: null,
  signalingState: null,
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setJoinedCall: (joinedCall) => set({ joinedCall }),
  setPeerConnectionStates: (states) => set(states),
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
  clearJoinedCall: () => set({ joinedCall: null }),
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
      connectionState: null,
      iceConnectionState: null,
      iceGatheringState: null,
      signalingState: null,
    }),
}));
