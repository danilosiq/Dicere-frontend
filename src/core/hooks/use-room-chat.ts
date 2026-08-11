"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  MAX_CHAT_MESSAGE_CHARACTERS,
  type ChatMessage,
} from "@/core/@types/chat";
import type { DeepLTargetLanguage } from "@/core/components";
import { mergeChatMessages } from "@/core/features/room/utils/merge-chat-messages";
import {
  ChatOperationAbortedError,
  isChatConnected,
  listChatMessages,
  sendChatMessage,
  subscribeToChatConnection,
  subscribeToReceivedChatMessages,
} from "@/core/services/chat-service";

type UseRoomChatParams = {
  roomId?: string;
  participantId?: string;
};

type RoomMessagesState = {
  roomId?: string;
  messages: ChatMessage[];
  revision: number;
};

type DraftState = {
  roomId?: string;
  value: string;
};

type SourceLanguageState = {
  roomId?: string;
  value?: DeepLTargetLanguage;
};

type SendState = {
  roomId?: string;
  isSending: boolean;
  error: string | null;
};

type HistoryState = {
  roomId?: string;
  hasLoadedInitial: boolean;
  isInitialLoading: boolean;
  initialError: string | null;
  isLoadingOlder: boolean;
  olderError: string | null;
  nextCursor: string | null;
};

type PendingHistoryRequest = {
  roomId: string;
  before?: string;
  controller: AbortController;
  ignoreResult: boolean;
  settled: Promise<void>;
  markSettled: () => void;
};

function createHistoryState(roomId?: string): HistoryState {
  return {
    roomId,
    hasLoadedInitial: false,
    isInitialLoading: Boolean(roomId),
    initialError: null,
    isLoadingOlder: false,
    olderError: null,
    nextCursor: null,
  };
}

function createSendState(roomId?: string): SendState {
  return {
    roomId,
    isSending: false,
    error: null,
  };
}

function getDraftValidationError(
  value: string,
  sourceLanguage?: DeepLTargetLanguage,
) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return "Escreva uma mensagem antes de enviar.";
  }

  if (normalizedValue.length > MAX_CHAT_MESSAGE_CHARACTERS) {
    return `A mensagem deve ter no máximo ${MAX_CHAT_MESSAGE_CHARACTERS} caracteres.`;
  }

  if (!sourceLanguage) {
    return "Selecione o idioma em que você está escrevendo.";
  }

  return null;
}

export function useRoomChat({ roomId, participantId }: UseRoomChatParams) {
  const [messagesState, setMessagesState] = useState<RoomMessagesState>({
    roomId,
    messages: [],
    revision: 0,
  });
  const [draftState, setDraftState] = useState<DraftState>({
    roomId,
    value: "",
  });
  const [sourceLanguageState, setSourceLanguageState] =
    useState<SourceLanguageState>({ roomId });
  const [sendState, setSendState] = useState<SendState>(() =>
    createSendState(roomId),
  );
  const [isConnected, setIsConnected] = useState(isChatConnected);
  const [historyState, setHistoryState] = useState<HistoryState>(() =>
    createHistoryState(roomId),
  );
  const pendingSendRef = useRef(false);
  const sendControllerRef = useRef<AbortController | null>(null);
  const pendingHistoryRef = useRef<PendingHistoryRequest | null>(null);

  const messages =
    messagesState.roomId === roomId ? messagesState.messages : [];
  const messageRevision =
    messagesState.roomId === roomId ? messagesState.revision : 0;
  const draft = draftState.roomId === roomId ? draftState.value : "";
  const sourceLanguage =
    sourceLanguageState.roomId === roomId
      ? sourceLanguageState.value
      : undefined;
  const history =
    historyState.roomId === roomId ? historyState : createHistoryState(roomId);
  const currentSendState =
    sendState.roomId === roomId ? sendState : createSendState(roomId);
  const validationError = useMemo(
    () =>
      draft.length > 0 ? getDraftValidationError(draft, sourceLanguage) : null,
    [draft, sourceLanguage],
  );

  useEffect(() => subscribeToChatConnection(setIsConnected), []);

  useEffect(() => {
    return () => {
      sendControllerRef.current?.abort();
    };
  }, [roomId]);

  useEffect(() => {
    return () => {
      pendingHistoryRef.current?.controller.abort();
    };
  }, []);

  const setDraft = useCallback(
    (value: string) => {
      setDraftState({ roomId, value });
      setSendState((current) => ({
        ...(current.roomId === roomId ? current : createSendState(roomId)),
        error: null,
      }));
    },
    [roomId],
  );

  const setSourceLanguage = useCallback(
    (value: DeepLTargetLanguage) => {
      setSourceLanguageState({ roomId, value });
      setSendState((current) => ({
        ...(current.roomId === roomId ? current : createSendState(roomId)),
        error: null,
      }));
    },
    [roomId],
  );

  const mergeMessages = useCallback(
    (incomingMessages: ChatMessage[]) => {
      if (!roomId) return;

      const roomMessages = incomingMessages.filter(
        (message) => message.roomId === roomId,
      );
      if (roomMessages.length === 0) return;

      setMessagesState((current) => {
        const currentMessages =
          current.roomId === roomId ? current.messages : [];
        const messages = mergeChatMessages(currentMessages, roomMessages);
        const currentIds = new Set(
          currentMessages.map((message) => message.id),
        );
        const hasNewMessage = roomMessages.some(
          (message) => !currentIds.has(message.id),
        );
        const hasChanged =
          hasNewMessage ||
          messages.some((message, index) => message !== currentMessages[index]);

        if (!hasChanged && current.roomId === roomId) {
          return current;
        }

        return {
          roomId,
          messages,
          revision:
            (current.roomId === roomId ? current.revision : 0) +
            (hasNewMessage ? 1 : 0),
        };
      });
    },
    [roomId],
  );

  const loadHistoryPage = useCallback(
    async ({ before }: { before?: string } = {}) => {
      if (!roomId || pendingHistoryRef.current || pendingSendRef.current) {
        return false;
      }

      const controller = new AbortController();
      let markSettled: () => void = () => undefined;
      const settled = new Promise<void>((resolve) => {
        markSettled = resolve;
      });
      const request: PendingHistoryRequest = {
        roomId,
        before,
        controller,
        ignoreResult: false,
        settled,
        markSettled,
      };
      pendingHistoryRef.current = request;

      setHistoryState((current) => {
        const roomHistory =
          current.roomId === roomId ? current : createHistoryState(roomId);

        return {
          ...roomHistory,
          isInitialLoading: before ? roomHistory.isInitialLoading : true,
          initialError: before ? roomHistory.initialError : null,
          isLoadingOlder: Boolean(before),
          olderError: before ? null : roomHistory.olderError,
        };
      });

      try {
        const payload = await listChatMessages({
          roomId,
          limit: 30,
          before,
          signal: controller.signal,
        });

        if (
          controller.signal.aborted ||
          request.ignoreResult ||
          pendingHistoryRef.current !== request
        ) {
          return false;
        }

        mergeMessages(payload.messages);
        setHistoryState((current) => {
          const roomHistory =
            current.roomId === roomId ? current : createHistoryState(roomId);

          return {
            ...roomHistory,
            hasLoadedInitial: true,
            isInitialLoading: false,
            initialError: null,
            isLoadingOlder: false,
            olderError: null,
            nextCursor: payload.nextCursor,
          };
        });
        return true;
      } catch (cause) {
        if (
          cause instanceof ChatOperationAbortedError ||
          request.ignoreResult
        ) {
          return false;
        }

        const message =
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar as mensagens.";

        setHistoryState((current) => {
          const roomHistory =
            current.roomId === roomId ? current : createHistoryState(roomId);

          return {
            ...roomHistory,
            isInitialLoading: false,
            initialError: before ? roomHistory.initialError : message,
            isLoadingOlder: false,
            olderError: before ? message : roomHistory.olderError,
          };
        });
        return false;
      } finally {
        if (pendingHistoryRef.current === request) {
          pendingHistoryRef.current = null;
        }
        request.markSettled();
      }
    },
    [mergeMessages, roomId],
  );

  useEffect(() => {
    let isCancelled = false;
    let unsubscribe: () => void = () => undefined;

    if (roomId) {
      unsubscribe = subscribeToReceivedChatMessages({
        roomId,
        onMessage: (message) => {
          if (!isCancelled) mergeMessages([message]);
        },
      });
    }

    queueMicrotask(async () => {
      if (isCancelled) return;

      setMessagesState((current) =>
        current.roomId === roomId
          ? current
          : { roomId, messages: [], revision: 0 },
      );
      setHistoryState((current) =>
        current.roomId === roomId ? current : createHistoryState(roomId),
      );

      const pendingRequest = pendingHistoryRef.current;
      if (pendingRequest && pendingRequest.roomId !== roomId) {
        pendingRequest.ignoreResult = true;
        await pendingRequest.settled;
      }

      if (isCancelled) return;

      if (roomId) {
        void loadHistoryPage();
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [loadHistoryPage, mergeMessages, roomId]);

  const sendMessage = useCallback(async () => {
    if (pendingSendRef.current) return false;

    if (pendingHistoryRef.current) {
      setSendState({
        roomId,
        isSending: false,
        error: "Aguarde o carregamento das mensagens antes de enviar.",
      });
      return false;
    }

    const normalizedDraft = draft.trim();
    const error = getDraftValidationError(draft, sourceLanguage);

    if (error) {
      setSendState({ roomId, isSending: false, error });
      return false;
    }

    if (!roomId || !participantId) {
      setSendState({
        roomId,
        isSending: false,
        error: "A sessão da sala não está disponível.",
      });
      return false;
    }

    if (!isConnected) {
      setSendState({
        roomId,
        isSending: false,
        error: "A conexão com o chat foi interrompida. Tente novamente.",
      });
      return false;
    }

    pendingSendRef.current = true;
    setSendState({ roomId, isSending: true, error: null });

    const controller = new AbortController();
    const submittedDraft = draft;
    sendControllerRef.current?.abort();
    sendControllerRef.current = controller;

    try {
      const message = await sendChatMessage({
        roomId,
        content: normalizedDraft,
        sourceLanguage: sourceLanguage!,
        signal: controller.signal,
      });

      if (message.participantId !== participantId) {
        throw new Error(
          "O servidor confirmou a mensagem para outro participante.",
        );
      }

      mergeMessages([message]);
      setDraftState((current) =>
        current.roomId === roomId && current.value === submittedDraft
          ? { roomId, value: "" }
          : current,
      );
      return true;
    } catch (cause) {
      if (!(cause instanceof ChatOperationAbortedError)) {
        setSendState({
          roomId,
          isSending: false,
          error:
            cause instanceof Error
              ? cause.message
              : "Não foi possível enviar a mensagem.",
        });
      }

      return false;
    } finally {
      if (sendControllerRef.current === controller) {
        sendControllerRef.current = null;
        pendingSendRef.current = false;
        setSendState((current) =>
          current.roomId === roomId
            ? { ...current, isSending: false }
            : current,
        );
      }
    }
  }, [
    draft,
    isConnected,
    mergeMessages,
    participantId,
    roomId,
    sourceLanguage,
  ]);

  const loadOlder = useCallback(() => {
    if (
      !history.nextCursor ||
      history.isInitialLoading ||
      history.isLoadingOlder
    ) {
      return Promise.resolve(false);
    }

    return loadHistoryPage({ before: history.nextCursor });
  }, [
    history.isInitialLoading,
    history.isLoadingOlder,
    history.nextCursor,
    loadHistoryPage,
  ]);

  const retryHistory = useCallback(() => loadHistoryPage(), [loadHistoryPage]);

  const retryOlder = useCallback(
    () =>
      history.nextCursor
        ? loadHistoryPage({ before: history.nextCursor })
        : Promise.resolve(false),
    [history.nextCursor, loadHistoryPage],
  );

  return {
    messages,
    messageRevision,
    draft,
    sourceLanguage,
    characterCount: draft.trim().length,
    validationError,
    sendError: currentSendState.error,
    isConnected,
    isSending: currentSendState.isSending,
    hasLoadedInitial: history.hasLoadedInitial,
    isInitialLoading: history.isInitialLoading,
    initialError: history.initialError,
    isLoadingOlder: history.isLoadingOlder,
    olderError: history.olderError,
    nextCursor: history.nextCursor,
    hasOlderMessages: history.nextCursor !== null,
    canSend:
      Boolean(roomId && participantId) &&
      isConnected &&
      !currentSendState.isSending &&
      !history.isInitialLoading &&
      !history.isLoadingOlder &&
      getDraftValidationError(draft, sourceLanguage) === null,
    setDraft,
    setSourceLanguage,
    sendMessage,
    retrySend: sendMessage,
    loadOlder,
    retryHistory,
    retryOlder,
  };
}
