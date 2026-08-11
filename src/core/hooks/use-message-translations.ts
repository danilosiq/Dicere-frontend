"use client";

import { useMutation } from "@tanstack/react-query";
import axios from "axios";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChatMessage, ChatMessageTranslation } from "@/core/@types/chat";
import { isDeepLTargetLanguage } from "@/core/components/selector-country/countryList";
import { translateChatMessage } from "@/core/services/chat-service";

export type MessageTranslationDisplayMode = "original" | "translated";

export type MessageTranslationViewState = {
  displayedContent: string;
  displayMode: MessageTranslationDisplayMode;
  translatedContent?: string;
  hasTranslation: boolean;
  isLoading: boolean;
  error: string | null;
  disabledReason: string | null;
};

type TranslationEntry = {
  displayMode: MessageTranslationDisplayMode;
  translatedContent?: string;
  isLoading: boolean;
  error: string | null;
};

type TranslationState = {
  scopeKey: string;
  entries: Record<string, TranslationEntry>;
};

type UseMessageTranslationsParams = {
  roomId?: string;
  targetLanguage?: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTranslationResponse(
  value: unknown,
  message: ChatMessage,
  targetLanguage: string,
): value is ChatMessageTranslation {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ChatMessageTranslation>;

  return (
    candidate.messageId === message.id &&
    candidate.targetLanguage === targetLanguage &&
    candidate.originalContent === message.content &&
    isNonEmptyString(candidate.translatedContent)
  );
}

function getTranslationErrorMessage(cause: unknown) {
  if (axios.isAxiosError<{ message?: unknown }>(cause)) {
    if (!cause.response) {
      return "Não foi possível conectar ao serviço de tradução. Tente novamente.";
    }

    if (cause.response.status === 400) {
      return "Não foi possível traduzir esta mensagem. Verifique os dados e tente novamente.";
    }

    if (cause.response.status === 404) {
      return "A mensagem não está mais disponível para tradução.";
    }

    if (cause.response.status >= 500) {
      return "O serviço de tradução está indisponível. Tente novamente em instantes.";
    }
  }

  return cause instanceof Error
    ? cause.message
    : "Não foi possível traduzir a mensagem.";
}

function createEntryKey(messageId: string, targetLanguage: string) {
  return `${messageId}:${targetLanguage}`;
}

export function useMessageTranslations({
  roomId,
  targetLanguage,
}: UseMessageTranslationsParams) {
  const validTargetLanguage = isDeepLTargetLanguage(targetLanguage)
    ? targetLanguage
    : null;
  const scopeKey = roomId ?? "no-room";
  const [state, setState] = useState<TranslationState>({
    scopeKey,
    entries: {},
  });
  const scopeKeyRef = useRef(scopeKey);
  const entriesRef = useRef<TranslationState>(state);
  const inFlightRef = useRef(new Map<string, Promise<boolean>>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const mutation = useMutation({
    mutationFn: translateChatMessage,
    retry: false,
  });

  if (state.scopeKey !== scopeKey) {
    setState({ scopeKey, entries: {} });
  }

  const currentEntries = useMemo(
    () => (state.scopeKey === scopeKey ? state.entries : {}),
    [scopeKey, state],
  );

  useEffect(() => {
    const controllers = controllersRef.current;
    const inFlight = inFlightRef.current;
    const nextState: TranslationState = { scopeKey, entries: {} };

    scopeKeyRef.current = scopeKey;
    entriesRef.current = nextState;

    return () => {
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
      inFlight.clear();
    };
  }, [scopeKey]);

  const updateEntry = useCallback(
    (
      requestScopeKey: string,
      entryKey: string,
      updater: (entry: TranslationEntry | undefined) => TranslationEntry,
    ) => {
      if (scopeKeyRef.current !== requestScopeKey) return;

      const current =
        entriesRef.current.scopeKey === requestScopeKey
          ? entriesRef.current
          : { scopeKey: requestScopeKey, entries: {} };
      const next: TranslationState = {
        scopeKey: requestScopeKey,
        entries: {
          ...current.entries,
          [entryKey]: updater(current.entries[entryKey]),
        },
      };

      entriesRef.current = next;
      setState(next);
    },
    [],
  );

  const translate = useCallback(
    (message: ChatMessage) => {
      if (!roomId || !validTargetLanguage) return Promise.resolve(false);

      const requestScopeKey = scopeKey;
      const entryKey = createEntryKey(message.id, validTargetLanguage);
      const existingRequest = inFlightRef.current.get(entryKey);
      if (existingRequest) return existingRequest;

      const cachedEntry =
        entriesRef.current.scopeKey === requestScopeKey
          ? entriesRef.current.entries[entryKey]
          : undefined;
      if (cachedEntry?.translatedContent) {
        updateEntry(requestScopeKey, entryKey, (entry) => ({
          ...entry!,
          displayMode: "translated",
          isLoading: false,
          error: null,
        }));
        return Promise.resolve(true);
      }

      updateEntry(requestScopeKey, entryKey, (entry) => ({
        ...entry,
        displayMode: "original",
        isLoading: true,
        error: null,
      }));

      const controller = new AbortController();
      controllersRef.current.set(entryKey, controller);

      const request = mutation
        .mutateAsync({
          messageId: message.id,
          targetLanguage: validTargetLanguage,
          signal: controller.signal,
        })
        .then((response) => {
          if (
            scopeKeyRef.current !== requestScopeKey ||
            controller.signal.aborted
          ) {
            return false;
          }

          if (
            !isValidTranslationResponse(response, message, validTargetLanguage)
          ) {
            throw new Error(
              "O servidor retornou uma tradução incompatível com a mensagem.",
            );
          }

          updateEntry(requestScopeKey, entryKey, () => ({
            displayMode: "translated",
            translatedContent: response.translatedContent,
            isLoading: false,
            error: null,
          }));
          return true;
        })
        .catch((cause: unknown) => {
          if (
            scopeKeyRef.current !== requestScopeKey ||
            controller.signal.aborted
          ) {
            return false;
          }

          updateEntry(requestScopeKey, entryKey, (entry) => ({
            ...entry,
            displayMode: "original",
            isLoading: false,
            error: getTranslationErrorMessage(cause),
          }));
          return false;
        })
        .finally(() => {
          if (controllersRef.current.get(entryKey) === controller) {
            controllersRef.current.delete(entryKey);
          }
          if (inFlightRef.current.get(entryKey) === request) {
            inFlightRef.current.delete(entryKey);
          }
        });

      inFlightRef.current.set(entryKey, request);
      return request;
    },
    [mutation, roomId, scopeKey, updateEntry, validTargetLanguage],
  );

  const showOriginal = useCallback(
    (messageId: string) => {
      if (!validTargetLanguage) return;

      const entryKey = createEntryKey(messageId, validTargetLanguage);
      updateEntry(scopeKey, entryKey, (entry) => ({
        ...entry!,
        displayMode: "original",
      }));
    },
    [scopeKey, updateEntry, validTargetLanguage],
  );

  const showTranslation = useCallback(
    (messageId: string) => {
      if (!validTargetLanguage) return;

      const entryKey = createEntryKey(messageId, validTargetLanguage);
      const entry = entriesRef.current.entries[entryKey];
      if (!entry?.translatedContent) return;

      updateEntry(scopeKey, entryKey, (current) => ({
        ...current!,
        displayMode: "translated",
        error: null,
      }));
    },
    [scopeKey, updateEntry, validTargetLanguage],
  );

  const getTranslationState = useCallback(
    (message: ChatMessage): MessageTranslationViewState => {
      const disabledReason = !roomId
        ? "A sessão da sala não está disponível para tradução."
        : !validTargetLanguage
          ? "Selecione um idioma de destino válido para traduzir."
          : null;
      const entryKey = validTargetLanguage
        ? createEntryKey(message.id, validTargetLanguage)
        : null;
      const entry = entryKey ? currentEntries[entryKey] : undefined;
      const displayMode = entry?.displayMode ?? "original";
      const translatedContent = entry?.translatedContent;

      return {
        displayedContent:
          displayMode === "translated" && translatedContent
            ? translatedContent
            : message.content,
        displayMode,
        translatedContent,
        hasTranslation: Boolean(translatedContent),
        isLoading: entry?.isLoading ?? false,
        error: entry?.error ?? null,
        disabledReason,
      };
    },
    [currentEntries, roomId, validTargetLanguage],
  );

  return {
    targetLanguage: validTargetLanguage,
    getTranslationState,
    translate,
    retryTranslation: translate,
    showOriginal,
    showTranslation,
  };
}
