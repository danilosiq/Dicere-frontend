"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  requestLocalMedia,
  stopMediaStream,
} from "@/core/services/media-service";
import { useCallStore } from "@/core/store/call-store";

export type LocalMediaErrorCode =
  | "permission-denied"
  | "device-not-found"
  | "device-in-use"
  | "constraints-not-supported"
  | "not-supported"
  | "request-aborted"
  | "unknown";

export type LocalMediaError = {
  code: LocalMediaErrorCode;
  message: string;
  cause: unknown;
};

type StartLocalMediaParams = {
  constraints?: MediaStreamConstraints;
};

const ERROR_BY_NAME: Record<
  string,
  Pick<LocalMediaError, "code" | "message">
> = {
  NotAllowedError: {
    code: "permission-denied",
    message: "Permita o acesso à câmera e ao microfone para entrar na chamada.",
  },
  SecurityError: {
    code: "permission-denied",
    message: "O acesso à câmera e ao microfone foi bloqueado pelo navegador.",
  },
  NotFoundError: {
    code: "device-not-found",
    message: "Nenhuma câmera ou microfone disponível foi encontrado.",
  },
  DevicesNotFoundError: {
    code: "device-not-found",
    message: "Nenhuma câmera ou microfone disponível foi encontrado.",
  },
  NotReadableError: {
    code: "device-in-use",
    message:
      "Não foi possível acessar a câmera ou o microfone. Verifique se outro aplicativo está usando o dispositivo.",
  },
  TrackStartError: {
    code: "device-in-use",
    message:
      "Não foi possível acessar a câmera ou o microfone. Verifique se outro aplicativo está usando o dispositivo.",
  },
  OverconstrainedError: {
    code: "constraints-not-supported",
    message:
      "A câmera ou o microfone não atende às configurações necessárias para a chamada.",
  },
  ConstraintNotSatisfiedError: {
    code: "constraints-not-supported",
    message:
      "A câmera ou o microfone não atende às configurações necessárias para a chamada.",
  },
  NotSupportedError: {
    code: "not-supported",
    message:
      "Este navegador não oferece suporte ao acesso de câmera e microfone.",
  },
  AbortError: {
    code: "request-aborted",
    message: "O acesso à câmera e ao microfone foi interrompido.",
  },
};

function normalizeLocalMediaError(cause: unknown): LocalMediaError {
  const errorName = cause instanceof Error ? cause.name : "";
  const knownError = ERROR_BY_NAME[errorName];

  if (knownError) {
    return { ...knownError, cause };
  }

  return {
    code: "unknown",
    message:
      "Não foi possível iniciar a câmera e o microfone. Tente novamente.",
    cause,
  };
}

function hasLiveTracks(stream: MediaStream | null) {
  return (
    stream?.getTracks().some((track) => track.readyState === "live") ?? false
  );
}

export function useLocalMedia() {
  const localStream = useCallStore((state) => state.localStream);
  const setLocalStream = useCallStore((state) => state.setLocalStream);
  const clearLocalStream = useCallStore((state) => state.clearLocalStream);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<LocalMediaError | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const pendingRequestRef = useRef<Promise<MediaStream | null> | null>(null);
  const requestVersionRef = useRef(0);
  const isMountedRef = useRef(false);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const stopLocalMedia = useCallback(() => {
    requestVersionRef.current += 1;
    pendingRequestRef.current = null;

    const stream = localStreamRef.current;
    localStreamRef.current = null;
    stopMediaStream({ stream });
    clearLocalStream(stream ?? undefined);
    setIsRequesting(false);
    setError(null);
  }, [clearLocalStream]);

  const startLocalMedia = useCallback(
    ({ constraints }: StartLocalMediaParams = {}) => {
      const currentStream = localStreamRef.current;

      if (hasLiveTracks(currentStream)) {
        return Promise.resolve(currentStream);
      }

      if (pendingRequestRef.current) {
        return pendingRequestRef.current;
      }

      const requestVersion = requestVersionRef.current + 1;
      requestVersionRef.current = requestVersion;
      setIsRequesting(true);
      setError(null);

      const request = requestLocalMedia({ constraints })
        .then((stream) => {
          if (
            !isMountedRef.current ||
            requestVersionRef.current !== requestVersion
          ) {
            stopMediaStream({ stream });
            return null;
          }

          const previousStream = localStreamRef.current;

          if (previousStream && previousStream !== stream) {
            stopMediaStream({ stream: previousStream });
          }

          localStreamRef.current = stream;
          setLocalStream(stream);

          return stream;
        })
        .catch((cause: unknown) => {
          if (
            isMountedRef.current &&
            requestVersionRef.current === requestVersion
          ) {
            setError(normalizeLocalMediaError(cause));
          }

          return null;
        })
        .finally(() => {
          if (requestVersionRef.current === requestVersion) {
            pendingRequestRef.current = null;

            if (isMountedRef.current) {
              setIsRequesting(false);
            }
          }
        });

      pendingRequestRef.current = request;
      return request;
    },
    [setLocalStream],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      requestVersionRef.current += 1;
      pendingRequestRef.current = null;

      const stream = localStreamRef.current;
      localStreamRef.current = null;
      stopMediaStream({ stream });
      clearLocalStream(stream ?? undefined);
    };
  }, [clearLocalStream]);

  return {
    localStream,
    startLocalMedia,
    stopLocalMedia,
    isRequesting,
    isError: error !== null,
    error,
    errorMessage: error?.message ?? null,
  };
}
