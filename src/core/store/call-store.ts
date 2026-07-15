import { create } from "zustand";

type CallStore = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState | null;
  iceConnectionState: RTCIceConnectionState | null;
  iceGatheringState: RTCIceGatheringState | null;
  signalingState: RTCSignalingState | null;
  setLocalStream: (stream: MediaStream) => void;
  setRemoteStream: (stream: MediaStream) => void;
  setPeerConnectionStates: (states: PeerConnectionStates) => void;
  clearLocalStream: (expectedStream?: MediaStream) => void;
  clearRemoteStream: (expectedStream?: MediaStream) => void;
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
  connectionState: null,
  iceConnectionState: null,
  iceGatheringState: null,
  signalingState: null,
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
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
      connectionState: null,
      iceConnectionState: null,
      iceGatheringState: null,
      signalingState: null,
    }),
}));
