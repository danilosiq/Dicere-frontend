export const DEFAULT_LOCAL_MEDIA_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: {
    facingMode: "user",
  },
} satisfies MediaStreamConstraints;

type RequestLocalMediaParams = {
  constraints?: MediaStreamConstraints;
};

type StopMediaStreamParams = {
  stream: MediaStream | null;
};

type SetMediaTrackEnabledParams = {
  stream: MediaStream | null;
  kind: "audio" | "video";
  enabled: boolean;
};

export async function requestLocalMedia({
  constraints = DEFAULT_LOCAL_MEDIA_CONSTRAINTS,
}: RequestLocalMediaParams = {}) {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia
  ) {
    const error = new Error(
      "O navegador não oferece suporte ao acesso de câmera e microfone.",
    );
    error.name = "NotSupportedError";
    throw error;
  }

  return navigator.mediaDevices.getUserMedia(constraints);
}

export function stopMediaStream({ stream }: StopMediaStreamParams) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function setMediaTrackEnabled({
  stream,
  kind,
  enabled,
}: SetMediaTrackEnabledParams) {
  const tracks =
    kind === "audio" ? stream?.getAudioTracks() : stream?.getVideoTracks();

  tracks?.forEach((track) => {
    track.enabled = enabled;
  });

  return (tracks?.length ?? 0) > 0;
}
