"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DeepLTargetLanguage } from "@/core/components";
import { setTranslationLanguage } from "@/core/services/translation-language-service";
import { useRoomSessionStore } from "@/core/store/room-session-store";

export function useTranslationLanguage(
  roomId?: string,
  participantId?: string,
) {
  const applyLanguage = useRoomSessionStore((state) => state.setTargetLanguage);
  const generation = useRef(0);
  const pending = useRef(false);
  const [status, setStatus] = useState<{
    roomId?: string;
    participantId?: string;
    pending: boolean;
    error?: string;
  }>({ pending: false });
  useEffect(
    () => () => {
      generation.current++;
      pending.current = false;
    },
    [roomId, participantId],
  );
  const changeLanguage = useCallback(
    async (language: DeepLTargetLanguage) => {
      if (!roomId || !participantId || pending.current) return;
      pending.current = true;
      const current = generation.current;
      setStatus({ roomId, participantId, pending: true });
      try {
        const confirmed = await setTranslationLanguage(language);
        if (current !== generation.current) return;
        if (
          confirmed.roomId !== roomId ||
          confirmed.participantId !== participantId
        )
          throw new Error("A confirmação pertence a outra sessão.");
        applyLanguage(roomId, participantId, confirmed.targetLanguage);
        setStatus({ roomId, participantId, pending: false });
      } catch (error) {
        if (current === generation.current)
          setStatus({
            roomId,
            participantId,
            pending: false,
            error:
              error instanceof Error
                ? error.message
                : "Não foi possível alterar o idioma.",
          });
      } finally {
        if (current === generation.current) pending.current = false;
      }
    },
    [roomId, participantId, applyLanguage],
  );
  const current =
    status.roomId === roomId && status.participantId === participantId;
  return {
    changeLanguage,
    isUpdating: current && status.pending,
    error: current ? status.error : undefined,
  };
}
