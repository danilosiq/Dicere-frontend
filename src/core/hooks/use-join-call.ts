"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CallJoinedPayload } from "@/core/@types/socket-events";
import {
  joinCall as joinCallService,
  JoinCallRequestError,
} from "@/core/services/call-signaling-service";
import { useCallStore } from "@/core/store/call-store";

export type JoinCallError = {
  code: string;
  message: string;
  cause: unknown;
};

function normalizeJoinCallError(cause: unknown): JoinCallError {
  if (cause instanceof JoinCallRequestError) {
    return {
      code: cause.code,
      message: cause.message,
      cause,
    };
  }

  return {
    code: "UNKNOWN_JOIN_CALL_ERROR",
    message: "Não foi possível entrar na chamada. Tente novamente.",
    cause,
  };
}

export function useJoinCall() {
  const joinedCall = useCallStore((state) => state.joinedCall);
  const setJoinedCall = useCallStore((state) => state.setJoinedCall);
  const clearJoinedCall = useCallStore((state) => state.clearJoinedCall);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<JoinCallError | null>(null);
  const pendingRequestRef = useRef<Promise<CallJoinedPayload | null> | null>(
    null,
  );
  const isMountedRef = useRef(false);

  const joinCall = useCallback(() => {
    if (pendingRequestRef.current) {
      return pendingRequestRef.current;
    }

    setIsJoining(true);
    setError(null);

    const request = joinCallService()
      .then((confirmation) => {
        setJoinedCall(confirmation);
        return confirmation;
      })
      .catch((cause: unknown) => {
        clearJoinedCall();

        if (isMountedRef.current) {
          setError(normalizeJoinCallError(cause));
        }

        return null;
      })
      .finally(() => {
        if (pendingRequestRef.current === request) {
          pendingRequestRef.current = null;
        }

        if (isMountedRef.current) {
          setIsJoining(false);
        }
      });

    pendingRequestRef.current = request;
    return request;
  }, [clearJoinedCall, setJoinedCall]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    joinCall,
    joinedCall,
    isJoined: joinedCall !== null,
    isJoining,
    isError: error !== null,
    error,
    errorMessage: error?.message ?? null,
    clearError,
  };
}
