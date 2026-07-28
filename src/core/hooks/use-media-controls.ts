"use client";

import { useCallback } from "react";

import { setMediaTrackEnabled } from "@/core/services/media-service";
import { useCallStore } from "@/core/store/call-store";

export function useMediaControls() {
  const localStream = useCallStore((state) => state.localStream);
  const microphoneEnabled = useCallStore((state) => state.microphoneEnabled);
  const cameraEnabled = useCallStore((state) => state.cameraEnabled);
  const setMicrophoneEnabled = useCallStore(
    (state) => state.setMicrophoneEnabled,
  );
  const setCameraEnabled = useCallStore((state) => state.setCameraEnabled);

  const hasMicrophone = (localStream?.getAudioTracks().length ?? 0) > 0;
  const hasCamera = (localStream?.getVideoTracks().length ?? 0) > 0;

  const toggleMicrophone = useCallback(() => {
    const nextEnabled = !microphoneEnabled;

    if (
      setMediaTrackEnabled({
        stream: localStream,
        kind: "audio",
        enabled: nextEnabled,
      })
    ) {
      setMicrophoneEnabled(nextEnabled);
    }
  }, [localStream, microphoneEnabled, setMicrophoneEnabled]);

  const toggleCamera = useCallback(() => {
    const nextEnabled = !cameraEnabled;

    if (
      setMediaTrackEnabled({
        stream: localStream,
        kind: "video",
        enabled: nextEnabled,
      })
    ) {
      setCameraEnabled(nextEnabled);
    }
  }, [cameraEnabled, localStream, setCameraEnabled]);

  return {
    microphoneEnabled,
    cameraEnabled,
    hasMicrophone,
    hasCamera,
    toggleMicrophone,
    toggleCamera,
  };
}
