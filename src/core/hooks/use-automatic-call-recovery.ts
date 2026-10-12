"use client";

import { useEffect, useRef, useState } from "react";
import { speechRecoveryDelay } from "@/core/services/server-speech/recovery-policy";

export function useAutomaticCallRecovery({
  enabled,
  needed,
  busy,
  recovered,
  recover,
}: {
  enabled: boolean;
  needed: boolean;
  busy: boolean;
  recovered: boolean;
  recover: () => Promise<unknown>;
}) {
  const callback = useRef(recover);
  const attempt = useRef(0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    callback.current = recover;
  }, [recover]);
  useEffect(() => {
    if (recovered) attempt.current = 0;
    if (!enabled || !needed || busy || navigator.onLine === false) return;
    let cancelled = false;
    const timer = setTimeout(
      () => {
        attempt.current++;
        void callback
          .current()
          .catch(() => undefined)
          .finally(() => {
            if (!cancelled) setCycle((value) => value + 1);
          });
      },
      speechRecoveryDelay(attempt.current + 1),
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [enabled, needed, busy, recovered, cycle]);
}

export function isTransientCallCode(code?: string) {
  return Boolean(
    code &&
    new Set([
      "SOCKET_NOT_CONNECTED",
      "SOCKET_DISCONNECTED",
      "JOIN_CALL_TIMEOUT",
      "JOIN_CALL_FAILED",
      "PARTICIPANT_ALREADY_IN_CALL",
      "INTERNAL_ERROR",
      "PARTICIPANT_READY_TIMEOUT",
    ]).has(code),
  );
}
