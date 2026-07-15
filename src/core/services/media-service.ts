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
