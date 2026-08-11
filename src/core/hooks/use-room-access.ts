"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import type { CreateRoomResult, JoinRoomPayload } from "@/core/@types/room";
import type { CreateRoomSchemaType } from "@/core/forms/create-room-form/schema";
import type { JoinRoomSchemaType } from "@/core/forms/join-room-form/schema";
import {
  createRoom,
  joinRoomWithReconnectRetry,
  RoomAccessError,
} from "@/core/services/room-service";
import { useRoomSessionStore } from "@/core/store/room-session-store";

type PendingCreatedRoom = {
  createdRoom: CreateRoomResult;
  formData: CreateRoomSchemaType;
};

function normalizeError(cause: unknown) {
  if (cause instanceof RoomAccessError) return cause;

  return new RoomAccessError({
    code: "ROOM_ACCESS_FAILED",
    message: "Não foi possível concluir a operação. Tente novamente.",
    cause,
  });
}

export function useRoomAccess() {
  const setJoinedSession = useRoomSessionStore(
    (state) => state.setJoinedSession,
  );
  const createRoomMutation = useMutation({ mutationFn: createRoom });
  const joinRoomMutation = useMutation({
    mutationFn: joinRoomWithReconnectRetry,
  });
  const pendingCreatedRoomRef = useRef<PendingCreatedRoom | null>(null);
  const [error, setError] = useState<RoomAccessError | null>(null);

  const enterRoom = useCallback(
    async (payload: JoinRoomPayload) => {
      setError(null);

      try {
        const joinedRoom = await joinRoomMutation.mutateAsync(payload);
        setJoinedSession(joinedRoom);
        return joinedRoom;
      } catch (cause) {
        const normalizedError = normalizeError(cause);
        setError(normalizedError);
        throw normalizedError;
      }
    },
    [joinRoomMutation, setJoinedSession],
  );

  const createAndEnterRoom = useCallback(
    async (data: CreateRoomSchemaType) => {
      setError(null);

      try {
        let pending = pendingCreatedRoomRef.current;

        if (!pending) {
          const createdRoom = await createRoomMutation.mutateAsync({
            title: data.title,
            password: data.password,
            participantName: data.nickname,
            targetLanguage: data.targetLanguage,
          });
          pending = { createdRoom, formData: data };
          pendingCreatedRoomRef.current = pending;
        }

        const joinedRoom = await enterRoom({
          roomCode: pending.createdRoom.code,
          password: pending.formData.password,
          nickname: pending.formData.nickname,
          targetLanguage: pending.formData.targetLanguage,
          participantId: pending.createdRoom.adminParticipantId,
        });
        pendingCreatedRoomRef.current = null;
        return joinedRoom;
      } catch (cause) {
        const normalizedError = normalizeError(cause);

        if (pendingCreatedRoomRef.current) {
          const connectionError = new RoomAccessError({
            code: normalizedError.code,
            message:
              "A sala foi criada, mas não foi possível conectar. Confirme novamente para tentar entrar.",
            cause: normalizedError,
          });
          setError(connectionError);
          throw connectionError;
        }

        setError(normalizedError);
        throw normalizedError;
      }
    },
    [createRoomMutation, enterRoom],
  );

  const joinExistingRoom = useCallback(
    (data: JoinRoomSchemaType, participantId?: string) =>
      enterRoom({
        roomCode: data.roomCode,
        password: data.password,
        nickname: data.name,
        targetLanguage: data.targetLanguage,
        participantId,
      }),
    [enterRoom],
  );

  const resetCreateFlow = useCallback(() => {
    pendingCreatedRoomRef.current = null;
    setError(null);
    createRoomMutation.reset();
    joinRoomMutation.reset();
  }, [createRoomMutation, joinRoomMutation]);

  const clearError = useCallback(() => setError(null), []);

  return {
    createAndEnterRoom,
    joinExistingRoom,
    resetCreateFlow,
    clearError,
    error,
    errorMessage: error?.message ?? null,
    isPending: createRoomMutation.isPending || joinRoomMutation.isPending,
  };
}
