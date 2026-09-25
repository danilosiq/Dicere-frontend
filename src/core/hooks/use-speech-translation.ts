"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SpeechSegmentStatus,
  TranslateSpeechPayload,
  VoiceTranslationReceivedPayload,
} from "@/core/@types/socket-events";
import type { DeepLTargetLanguage } from "@/core/components";
import {
  recordSpeechTranslationMetric,
  sendSpeechForTranslation,
  splitSpeechText,
  subscribeToSpeechTranslations,
} from "@/core/services/speech-translation-service";
import { toSpeechRecognitionLocale } from "@/core/utils/speech-recognition-language";
import { useLocalSpeech, type LocalCaptionIssue } from "./use-local-speech";
import { useServerSpeech } from "./use-server-speech";
import { isServerSpeechEnabled } from "@/core/services/server-speech/config";

export const SPEECH_TRANSLATION_HISTORY_LIMIT = 100;
export const SPEECH_PREVIOUS_CONTEXT_LIMIT = 250;
export type CaptionIssue = LocalCaptionIssue;
export type ReceivedVoiceTranslation = VoiceTranslationReceivedPayload & {
  sequence: number;
};

type NormalizedReceivedVoiceTranslation = ReceivedVoiceTranslation & {
  segmentId: string;
  revision: number;
  status: SpeechSegmentStatus;
  traceId: string;
};

let fallbackIdentifierSequence = 0;

function createIdentifier(prefix: string) {
  const generatedIdentifier = globalThis.crypto?.randomUUID?.();
  if (generatedIdentifier) return `${prefix}-${generatedIdentifier}`;

  fallbackIdentifierSequence += 1;
  return `${prefix}-${Date.now()}-${fallbackIdentifierSequence}`;
}

function getMonotonicNow() {
  return globalThis.performance?.now() ?? Date.now();
}

function getDeliveryKey(payload: TranslateSpeechPayload) {
  return `${payload.segmentId ?? "legacy"}:${payload.revision ?? 0}`;
}

function createFinalSpeechPayloads({
  roomId,
  text,
  sourceLanguage,
  previousContext,
  firstSequence,
}: {
  roomId: string;
  text: string;
  sourceLanguage: string;
  previousContext: string;
  firstSequence: number;
}) {
  let context = previousContext.slice(-SPEECH_PREVIOUS_CONTEXT_LIMIT);

  return splitSpeechText(text).map((chunk, index) => {
    const segmentId = createIdentifier("segment");
    const payload: TranslateSpeechPayload = {
      roomId,
      text: chunk,
      segmentId,
      sequence: firstSequence + index,
      revision: 1,
      status: "final",
      traceId: createIdentifier("trace"),
      clientSentAt: Date.now(),
      sourceLanguage,
      ...(context ? { previousContext: context } : {}),
    };

    context = chunk.slice(-SPEECH_PREVIOUS_CONTEXT_LIMIT);
    return payload;
  });
}

function normalizeReceivedTranslation(
  translation: VoiceTranslationReceivedPayload,
  fallbackSequence: number,
): NormalizedReceivedVoiceTranslation {
  const segmentId =
    translation.segmentId?.trim() || `legacy-${fallbackSequence}`;

  return {
    ...translation,
    segmentId,
    sequence: translation.sequence ?? fallbackSequence,
    revision: translation.revision ?? 1,
    status: translation.status ?? "final",
    traceId: translation.traceId?.trim() || segmentId,
  };
}

function mergeReceivedTranslation(
  current: NormalizedReceivedVoiceTranslation[],
  incoming: NormalizedReceivedVoiceTranslation,
) {
  const existingIndex = current.findIndex(
    ({ segmentId }) => segmentId === incoming.segmentId,
  );

  if (existingIndex >= 0) {
    const existing = current[existingIndex];
    const isOlderRevision = incoming.revision < existing.revision;
    const isDuplicateRevision =
      incoming.revision === existing.revision &&
      incoming.status === existing.status;
    const wouldReopenFinal =
      existing.status === "final" && incoming.status === "provisional";

    if (isOlderRevision || isDuplicateRevision || wouldReopenFinal) {
      return current;
    }

    const next = [...current];
    next[existingIndex] = incoming;
    return next.sort((left, right) => left.sequence - right.sequence);
  }

  return [...current, incoming]
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-SPEECH_TRANSLATION_HISTORY_LIMIT);
}

export function useSpeechTranslation({
  roomId,
  language,
  enabled,
}: {
  roomId?: string;
  language: DeepLTargetLanguage;
  enabled: boolean;
}) {
  const [translations, setTranslations] = useState<ReceivedVoiceTranslation[]>(
    [],
  );
  const [deliveryIssue, setDeliveryIssue] = useState<CaptionIssue | null>(null);
  const [stateRoomId, setStateRoomId] = useState(roomId);
  if (stateRoomId !== roomId) {
    setStateRoomId(roomId);
    setTranslations([]);
    setDeliveryIssue(null);
  }
  const pendingDeliveriesRef = useRef<TranslateSpeechPayload[]>([]);
  const inFlightDeliveriesRef = useRef(new Set<string>());
  const blockedDeliveriesRef = useRef(new Set<string>());
  const outboundSequenceRef = useRef(0);
  const incomingSequenceRef = useRef(0);
  const previousFinalContextRef = useRef("");
  const translationsRef = useRef<NormalizedReceivedVoiceTranslation[]>([]);
  const deliveryGenerationRef = useRef(0);
  const pendingCommitMetricsRef = useRef(
    new Map<
      string,
      { receivedAt: number; segmentId: string; traceId: string }
    >(),
  );
  const deliveryRetryTimerRef = useRef<number | null>(null);
  const retryPendingDeliveryRef = useRef<() => void>(() => undefined);
  const clearDeliveryTimer = useCallback(() => {
    if (deliveryRetryTimerRef.current !== null) {
      window.clearTimeout(deliveryRetryTimerRef.current);
      deliveryRetryTimerRef.current = null;
    }
  }, []);

  const deliverPendingPayload = useCallback(
    (payload: TranslateSpeechPayload) => {
      const generation = deliveryGenerationRef.current;
      const deliveryKey = getDeliveryKey(payload);
      if (
        inFlightDeliveriesRef.current.has(deliveryKey) ||
        blockedDeliveriesRef.current.has(deliveryKey)
      ) {
        return;
      }

      inFlightDeliveriesRef.current.add(deliveryKey);

      try {
        sendSpeechForTranslation(payload, {
          onAcknowledged: (acknowledgedPayload) => {
            if (generation !== deliveryGenerationRef.current) return;
            const acknowledgedKey = getDeliveryKey(acknowledgedPayload);
            inFlightDeliveriesRef.current.delete(acknowledgedKey);
            blockedDeliveriesRef.current.delete(acknowledgedKey);
            pendingDeliveriesRef.current = pendingDeliveriesRef.current.filter(
              (pendingPayload) =>
                getDeliveryKey(pendingPayload) !== acknowledgedKey,
            );

            if (pendingDeliveriesRef.current.length === 0) {
              clearDeliveryTimer();
              setDeliveryIssue(null);
            }
          },
          onTerminalError: (failedPayload, failure) => {
            if (generation !== deliveryGenerationRef.current) return;
            const failedKey = getDeliveryKey(failedPayload);
            inFlightDeliveriesRef.current.delete(failedKey);
            const isStillPending = pendingDeliveriesRef.current.some(
              (pendingPayload) => getDeliveryKey(pendingPayload) === failedKey,
            );
            if (!isStillPending) return;

            if (!failure.retryable) {
              blockedDeliveriesRef.current.add(failedKey);
            }
            setDeliveryIssue({
              status: failure.retryable ? "retry_wait" : "blocked",
              message: failure.message,
              retryable: false,
            });

            if (failure.retryable) {
              clearDeliveryTimer();
              deliveryRetryTimerRef.current = window.setTimeout(
                () => retryPendingDeliveryRef.current(),
                1_000,
              );
            }
          },
        });
      } catch (cause) {
        inFlightDeliveriesRef.current.delete(deliveryKey);
        throw cause;
      }
    },
    [clearDeliveryTimer],
  );

  const sendTranscript = useCallback(
    (text: string) => {
      const newText = text.trim();
      if (!newText) return;
      if (!roomId) return;

      if (newText) {
        const segmentationStartedAt = getMonotonicNow();
        const newPayloads = createFinalSpeechPayloads({
          roomId,
          text: newText,
          sourceLanguage: language,
          previousContext: previousFinalContextRef.current,
          firstSequence: outboundSequenceRef.current + 1,
        });

        if (newPayloads.length > 0) {
          outboundSequenceRef.current += newPayloads.length;
          previousFinalContextRef.current =
            newPayloads.at(-1)?.text.slice(-SPEECH_PREVIOUS_CONTEXT_LIMIT) ??
            previousFinalContextRef.current;
          pendingDeliveriesRef.current.push(...newPayloads);

          const segmentReadyAt = getMonotonicNow();
          newPayloads.forEach(({ segmentId, traceId }) => {
            recordSpeechTranslationMetric({
              name: "segment_ready",
              observedAt: segmentReadyAt,
              segmentId,
              traceId,
              durationMs: segmentReadyAt - segmentationStartedAt,
            });
          });
        }
      }

      try {
        pendingDeliveriesRef.current.forEach((payload) => {
          deliverPendingPayload(payload);
        });

        clearDeliveryTimer();
      } catch (cause) {
        setDeliveryIssue({
          status: "retry_wait",
          message:
            cause instanceof Error
              ? cause.message
              : "Não foi possível enviar este trecho para tradução.",
          retryable: false,
        });
        clearDeliveryTimer();
        deliveryRetryTimerRef.current = window.setTimeout(
          () => retryPendingDeliveryRef.current(),
          1_000,
        );
      }
    },
    [clearDeliveryTimer, deliverPendingPayload, language, roomId],
  );

  const retryPendingDelivery = useCallback(() => {
    if (pendingDeliveriesRef.current.length === 0 || !roomId) return;

    try {
      pendingDeliveriesRef.current.forEach((payload) => {
        deliverPendingPayload(payload);
      });

      clearDeliveryTimer();
    } catch (cause) {
      setDeliveryIssue({
        status: "retry_wait",
        message:
          cause instanceof Error
            ? cause.message
            : "Não foi possível enviar este trecho para tradução.",
        retryable: false,
      });
      clearDeliveryTimer();
      deliveryRetryTimerRef.current = window.setTimeout(
        () => retryPendingDeliveryRef.current(),
        1_000,
      );
    }
  }, [clearDeliveryTimer, deliverPendingPayload, roomId]);

  useEffect(() => {
    retryPendingDeliveryRef.current = retryPendingDelivery;
  }, [retryPendingDelivery]);

  useEffect(() => {
    pendingDeliveriesRef.current = [];
    inFlightDeliveriesRef.current.clear();
    blockedDeliveriesRef.current.clear();
    translationsRef.current = [];
    pendingCommitMetricsRef.current.clear();
    outboundSequenceRef.current = incomingSequenceRef.current = 0;
    previousFinalContextRef.current = "";
    const inFlight = inFlightDeliveriesRef.current;
    const blocked = blockedDeliveriesRef.current;
    return () => {
      deliveryGenerationRef.current += 1;
      clearDeliveryTimer();
      pendingDeliveriesRef.current = [];
      inFlight.clear();
      blocked.clear();
    };
  }, [roomId, clearDeliveryTimer]);

  useEffect(() => {
    previousFinalContextRef.current = "";
  }, [language]);

  const serverSpeech = isServerSpeechEnabled(roomId);
  const localRecognition = useLocalSpeech({
    roomId,
    locale: toSpeechRecognitionLocale(language),
    enabled: enabled && !serverSpeech,
    onText: sendTranscript,
  });
  const serverRecognition = useServerSpeech({
    roomId,
    locale: toSpeechRecognitionLocale(language),
    enabled: enabled && serverSpeech,
  });
  const recognition = serverSpeech ? serverRecognition : localRecognition;
  useEffect(() => {
    if (!roomId) return;

    return subscribeToSpeechTranslations({
      onTranslation: (translation) => {
        if (translation.roomId !== roomId) return;

        const fallbackSequence = incomingSequenceRef.current + 1;
        const normalizedTranslation = normalizeReceivedTranslation(
          translation,
          fallbackSequence,
        );
        incomingSequenceRef.current = Math.max(
          fallbackSequence,
          normalizedTranslation.sequence,
        );
        const nextTranslations = mergeReceivedTranslation(
          translationsRef.current,
          normalizedTranslation,
        );

        if (nextTranslations !== translationsRef.current) {
          const metricKey = `${normalizedTranslation.segmentId}:${normalizedTranslation.revision}:${normalizedTranslation.status}`;
          pendingCommitMetricsRef.current.set(metricKey, {
            receivedAt: getMonotonicNow(),
            segmentId: normalizedTranslation.segmentId,
            traceId: normalizedTranslation.traceId,
          });
          translationsRef.current = nextTranslations;
          setTranslations(nextTranslations);
        }
        if (pendingDeliveriesRef.current.length === 0) {
          setDeliveryIssue(null);
        }
      },
      onError: (message) => {
        setDeliveryIssue({
          status: "blocked",
          message,
          retryable: false,
        });
      },
    });
  }, [roomId]);

  useEffect(() => {
    if (pendingCommitMetricsRef.current.size === 0) return;

    const committedAt = getMonotonicNow();
    pendingCommitMetricsRef.current.forEach(
      ({ receivedAt, segmentId, traceId }) => {
        recordSpeechTranslationMetric({
          name: "commit",
          observedAt: committedAt,
          segmentId,
          traceId,
          durationMs: committedAt - receivedAt,
        });
      },
    );
    pendingCommitMetricsRef.current.clear();
  }, [translations]);

  return {
    translations,
    captionIssue: recognition.captionIssue ?? (enabled ? deliveryIssue : null),
    retryRecognition: recognition.retryRecognition,
  };
}
