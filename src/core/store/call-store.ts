import { create } from "zustand";

type CallStore = {
  localStream: MediaStream | null;
  setLocalStream: (stream: MediaStream) => void;
  clearLocalStream: (expectedStream?: MediaStream) => void;
  resetCallState: () => void;
};

export const useCallStore = create<CallStore>((set) => ({
  localStream: null,
  setLocalStream: (localStream) => set({ localStream }),
  clearLocalStream: (expectedStream) =>
    set((state) => {
      if (expectedStream && state.localStream !== expectedStream) {
        return state;
      }

      return { localStream: null };
    }),
  resetCallState: () => set({ localStream: null }),
}));
