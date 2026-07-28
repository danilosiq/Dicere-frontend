"use client";

import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { useCallback, useEffect, useRef, useState } from "react";

import type { VoiceTranslationReceivedPayload } from "@/core/@types/socket-events";
import type { DeepLTargetLanguage } from "@/core/components";
import {
  sendSpeechForTranslation,
  subscribeToSpeechTranslations,
} from "@/core/services/speech-translation-service";
import { toSpeechRecognitionLocale } from "@/core/utils/speech-recognition-language";

export const SPEECH_END_GRACE_MS = 150;
export const SPEECH_SILENT_REARM_MS = 250;
export const SPEECH_SILENCE_TIMEOUT_MS = 400;
export const SPEECH_CONTINUOUS_FLUSH_MS = 2_000;
export const SPEECH_RETRY_BACKOFF_MS = [
  1_000, 2_000, 4_000, 8_000, 16_000, 30_000,
] as const;

type FlushReason = "final" | "terminal";

export type SpeechRecognitionStatus =
  "disabled" | "starting" | "listening" | "retry_wait" | "blocked";

export type CaptionIssue = {
  status: "retry_wait" | "blocked";
  message: string;
  retryable: boolean;
};

type RecognitionMachine = {
  status: SpeechRecognitionStatus;
  issue: CaptionIssue | null;
  retryAttempt: number;
};

type RecognitionAction =
  | { type: "block"; message: string; retryable: boolean }
  | { type: "disable" }
  | { type: "healthy" }
  | { type: "manual-start" }
  | { type: "start" }
  | { type: "started" }
  | { type: "transient-error"; message: string };

type EndDisposition = "blocked" | "disabled" | "normal" | "retry" | "silent";

type UseSpeechTranslationParams = {
  roomId?: string;
  language: DeepLTargetLanguage;
  enabled: boolean;
};

export type ReceivedVoiceTranslation = VoiceTranslationReceivedPayload & {
  sequence: number;
};

const INITIAL_MACHINE: RecognitionMachine = {
  status: "disabled",
  issue: null,
  retryAttempt: 0,
};

function reduceRecognitionMachine(
  current: RecognitionMachine,
  action: RecognitionAction,
): RecognitionMachine {
  switch (action.type) {
    case "disable":
      return INITIAL_MACHINE;
    case "start":
      return { ...current, status: "starting" };
    case "manual-start":
      return { ...current, status: "starting", retryAttempt: 0 };
    case "started":
      return { ...current, status: "listening" };
    case "healthy":
      return { status: "listening", issue: null, retryAttempt: 0 };
    case "transient-error":
      return {
        status: "retry_wait",
        issue: {
          status: "retry_wait",
          message: action.message,
          retryable: true,
        },
        retryAttempt: current.retryAttempt + 1,
      };
    case "block":
      return {
        status: "blocked",
        issue: {
          status: "blocked",
          message: action.message,
          retryable: action.retryable,
        },
        retryAttempt: current.retryAttempt,
      };
  }
}

function classifyNativeError(
  error: string,
):
  | { kind: "blocked"; message: string; retryable: boolean }
  | { kind: "ignored" }
  | { kind: "silent" }
  | { kind: "transient"; message: string } {
  switch (error) {
    case "aborted":
      return { kind: "ignored" };
    case "no-speech":
      return { kind: "silent" };
    case "network":
      return {
        kind: "transient",
        message:
          "O serviço de reconhecimento de voz está temporariamente indisponível.",
      };
    case "not-allowed":
      return {
        kind: "blocked",
        message:
          "O navegador bloqueou o microfone. Libere a permissão para este site.",
        retryable: true,
      };
    case "service-not-allowed":
      return {
        kind: "blocked",
        message: "O navegador bloqueou o serviço de reconhecimento de voz.",
        retryable: true,
      };
    case "audio-capture":
      return {
        kind: "blocked",
        message:
          "O navegador não encontrou um microfone disponível para reconhecimento.",
        retryable: true,
      };
    case "language-not-supported":
      return {
        kind: "blocked",
        message:
          "O navegador não oferece reconhecimento para o idioma selecionado.",
        retryable: true,
      };
    default:
      return {
        kind: "blocked",
        message: `Falha no reconhecimento de voz: ${error}.`,
        retryable: false,
      };
  }
}

function stopListeningSafely() {
  void SpeechRecognition.stopListening().catch(() => undefined);
}

export function useSpeechTranslation({
  roomId,
  language,
  enabled,
}: UseSpeechTranslationParams) {
  const {
    transcript,
    finalTranscript,
    listening,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();
  const [translations, setTranslations] = useState<ReceivedVoiceTranslation[]>(
    [],
  );
  const [machine, setMachine] = useState<RecognitionMachine>(INITIAL_MACHINE);
  const [deliveryIssue, setDeliveryIssue] = useState<CaptionIssue | null>(null);

  const machineRef = useRef(machine);
  const desiredEnabledRef = useRef(false);
  const localeRef = useRef(toSpeechRecognitionLocale(language));
  const listeningRef = useRef(listening);
  const previousLocaleRef = useRef(toSpeechRecognitionLocale(language));
  const startInFlightRef = useRef(false);
  const endDispositionRef = useRef<EndDisposition>("normal");
  const detachNativeListenersRef = useRef<() => void>(() => undefined);
  const startRecognitionRef = useRef<(source?: "automatic" | "manual") => void>(
    () => undefined,
  );

  const sessionTranscriptRef = useRef("");
  const sessionFinalTranscriptRef = useRef("");
  const lastObservedFinalRef = useRef("");
  const sentCursorRef = useRef(0);
  const pendingDeliveryTextRef = useRef("");
  const translationSequenceRef = useRef(0);

  const silenceTimerRef = useRef<number | null>(null);
  const continuousTimerRef = useRef<number | null>(null);
  const speechEndTimerRef = useRef<number | null>(null);
  const rearmTimerRef = useRef<number | null>(null);
  const recognitionRetryTimerRef = useRef<number | null>(null);
  const deliveryRetryTimerRef = useRef<number | null>(null);
  const flushBufferRef = useRef<(reason: FlushReason) => void>(() => undefined);
  const retryPendingDeliveryRef = useRef<() => void>(() => undefined);
  const requestFinalizationRef = useRef<() => void>(() => undefined);
  const scheduleRecognitionRetryRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    desiredEnabledRef.current =
      enabled && Boolean(roomId) && browserSupportsSpeechRecognition;
    localeRef.current = toSpeechRecognitionLocale(language);
    listeningRef.current = listening;
  }, [browserSupportsSpeechRecognition, enabled, language, listening, roomId]);

  const transition = useCallback((action: RecognitionAction) => {
    const next = reduceRecognitionMachine(machineRef.current, action);
    machineRef.current = next;
    setMachine(next);
    return next;
  }, []);

  const clearSegmentTimers = useCallback(() => {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (continuousTimerRef.current !== null) {
      window.clearTimeout(continuousTimerRef.current);
      continuousTimerRef.current = null;
    }
    if (speechEndTimerRef.current !== null) {
      window.clearTimeout(speechEndTimerRef.current);
      speechEndTimerRef.current = null;
    }
  }, []);

  const clearRecognitionTimers = useCallback(() => {
    if (rearmTimerRef.current !== null) {
      window.clearTimeout(rearmTimerRef.current);
      rearmTimerRef.current = null;
    }
    if (recognitionRetryTimerRef.current !== null) {
      window.clearTimeout(recognitionRetryTimerRef.current);
      recognitionRetryTimerRef.current = null;
    }
  }, []);

  const clearDeliveryTimer = useCallback(() => {
    if (deliveryRetryTimerRef.current !== null) {
      window.clearTimeout(deliveryRetryTimerRef.current);
      deliveryRetryTimerRef.current = null;
    }
  }, []);

  const resetSessionCursor = useCallback(() => {
    sessionTranscriptRef.current = "";
    sessionFinalTranscriptRef.current = "";
    lastObservedFinalRef.current = "";
    sentCursorRef.current = 0;
    clearSegmentTimers();
  }, [clearSegmentTimers]);

  const flushBuffer = useCallback(
    (reason: FlushReason) => {
      clearSegmentTimers();

      const completeTranscript =
        reason === "final"
          ? sessionFinalTranscriptRef.current
          : sessionTranscriptRef.current;
      const cursor = Math.min(sentCursorRef.current, completeTranscript.length);
      const newText = completeTranscript.slice(cursor).trim();
      const text = [pendingDeliveryTextRef.current, newText]
        .filter(Boolean)
        .join(" ")
        .trim();

      if (!text || !roomId) return;

      // O cursor avança antes do envio porque uma eventual falha fica preservada
      // separadamente em pendingDeliveryTextRef e não pode entrar duas vezes.
      sentCursorRef.current = completeTranscript.length;

      try {
        const sentChunks = sendSpeechForTranslation({ roomId, text });
        if (sentChunks.length === 0) return;

        pendingDeliveryTextRef.current = "";
        clearDeliveryTimer();
        setDeliveryIssue(null);
      } catch (cause) {
        pendingDeliveryTextRef.current = text;
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
    [clearDeliveryTimer, clearSegmentTimers, roomId],
  );

  useEffect(() => {
    flushBufferRef.current = flushBuffer;
  }, [flushBuffer]);

  const retryPendingDelivery = useCallback(() => {
    const text = pendingDeliveryTextRef.current.trim();
    if (!text || !roomId) return;

    try {
      const sentChunks = sendSpeechForTranslation({ roomId, text });
      if (sentChunks.length === 0) return;

      pendingDeliveryTextRef.current = "";
      clearDeliveryTimer();
      setDeliveryIssue(null);
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
  }, [clearDeliveryTimer, roomId]);

  useEffect(() => {
    retryPendingDeliveryRef.current = retryPendingDelivery;
  }, [retryPendingDelivery]);

  const requestFinalization = useCallback(() => {
    clearSegmentTimers();
    if (
      !desiredEnabledRef.current ||
      machineRef.current.status !== "listening"
    ) {
      return;
    }

    endDispositionRef.current = "normal";
    if (listeningRef.current) stopListeningSafely();
  }, [clearSegmentTimers]);

  useEffect(() => {
    requestFinalizationRef.current = requestFinalization;
  }, [requestFinalization]);

  const scheduleRecognitionRetry = useCallback(() => {
    if (!desiredEnabledRef.current) return;

    clearRecognitionTimers();
    const attempt = Math.max(machineRef.current.retryAttempt, 1);
    const delay =
      SPEECH_RETRY_BACKOFF_MS[
        Math.min(attempt - 1, SPEECH_RETRY_BACKOFF_MS.length - 1)
      ];

    recognitionRetryTimerRef.current = window.setTimeout(() => {
      recognitionRetryTimerRef.current = null;
      startRecognitionRef.current("automatic");
    }, delay);
  }, [clearRecognitionTimers]);

  useEffect(() => {
    scheduleRecognitionRetryRef.current = scheduleRecognitionRetry;
  }, [scheduleRecognitionRetry]);

  const startRecognition = useCallback(
    (source: "automatic" | "manual" = "automatic") => {
      if (!desiredEnabledRef.current || startInFlightRef.current) return;

      clearRecognitionTimers();
      resetSessionCursor();
      endDispositionRef.current = "normal";
      startInFlightRef.current = true;
      transition({ type: source === "manual" ? "manual-start" : "start" });

      void SpeechRecognition.startListening({
        continuous: false,
        language: localeRef.current,
      }).catch(() => {
        startInFlightRef.current = false;
        if (!desiredEnabledRef.current) {
          transition({ type: "disable" });
          return;
        }
        endDispositionRef.current = "retry";
        transition({
          type: "transient-error",
          message: "Não foi possível iniciar o reconhecimento de voz.",
        });
        scheduleRecognitionRetryRef.current();
      });
    },
    [clearRecognitionTimers, resetSessionCursor, transition],
  );

  useEffect(() => {
    startRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  const attachNativeListeners = useCallback(
    (recognition: globalThis.SpeechRecognition | null) => {
      detachNativeListenersRef.current();
      if (!recognition) {
        detachNativeListenersRef.current = () => undefined;
        return;
      }

      const handleStart = () => {
        startInFlightRef.current = false;
        if (!desiredEnabledRef.current) {
          endDispositionRef.current = "disabled";
          transition({ type: "disable" });
          if (listeningRef.current) stopListeningSafely();
          return;
        }
        transition({ type: "started" });
      };
      const handleResult = () => {
        clearRecognitionTimers();
        endDispositionRef.current = "normal";
        transition({ type: "healthy" });
      };
      const handleSpeechEnd = () => {
        if (speechEndTimerRef.current !== null) {
          window.clearTimeout(speechEndTimerRef.current);
        }
        speechEndTimerRef.current = window.setTimeout(() => {
          speechEndTimerRef.current = null;
          requestFinalizationRef.current();
        }, SPEECH_END_GRACE_MS);
      };
      const handleNoMatch = () => {
        clearSegmentTimers();
        endDispositionRef.current = "silent";
        if (listeningRef.current) stopListeningSafely();
      };
      const handleError = (event: SpeechRecognitionErrorEvent) => {
        startInFlightRef.current = false;
        if (!desiredEnabledRef.current) {
          endDispositionRef.current = "disabled";
          transition({ type: "disable" });
          return;
        }
        const classified = classifyNativeError(event.error);

        if (classified.kind === "ignored") return;

        if (classified.kind === "silent") {
          clearSegmentTimers();
          endDispositionRef.current = "silent";
          if (listeningRef.current) stopListeningSafely();
          return;
        }

        clearRecognitionTimers();
        clearSegmentTimers();
        if (classified.kind === "transient") {
          endDispositionRef.current = "retry";
          transition({
            type: "transient-error",
            message: classified.message,
          });
        } else {
          endDispositionRef.current = "blocked";
          transition({
            type: "block",
            message: classified.message,
            retryable: classified.retryable,
          });
        }

        if (listeningRef.current) stopListeningSafely();
      };
      const handleEnd = () => {
        startInFlightRef.current = false;

        if (!desiredEnabledRef.current) {
          endDispositionRef.current = "disabled";
          transition({ type: "disable" });
          return;
        }

        const disposition = endDispositionRef.current;
        endDispositionRef.current = "normal";

        if (disposition === "blocked") return;
        if (disposition === "retry") {
          scheduleRecognitionRetryRef.current();
          return;
        }
        if (disposition === "disabled") return;

        if (disposition === "silent") {
          rearmTimerRef.current = window.setTimeout(() => {
            rearmTimerRef.current = null;
            startRecognitionRef.current("automatic");
          }, SPEECH_SILENT_REARM_MS);
          return;
        }

        if (rearmTimerRef.current !== null) {
          window.clearTimeout(rearmTimerRef.current);
        }
        rearmTimerRef.current = window.setTimeout(() => {
          rearmTimerRef.current = null;
          flushBufferRef.current("terminal");
          startRecognitionRef.current("automatic");
        }, SPEECH_END_GRACE_MS);
      };

      recognition.addEventListener("start", handleStart);
      recognition.addEventListener("audiostart", handleStart);
      recognition.addEventListener("result", handleResult);
      recognition.addEventListener("speechend", handleSpeechEnd);
      recognition.addEventListener("nomatch", handleNoMatch);
      recognition.addEventListener("error", handleError);
      recognition.addEventListener("end", handleEnd);

      detachNativeListenersRef.current = () => {
        recognition.removeEventListener("start", handleStart);
        recognition.removeEventListener("audiostart", handleStart);
        recognition.removeEventListener("result", handleResult);
        recognition.removeEventListener("speechend", handleSpeechEnd);
        recognition.removeEventListener("nomatch", handleNoMatch);
        recognition.removeEventListener("error", handleError);
        recognition.removeEventListener("end", handleEnd);
      };
    },
    [clearRecognitionTimers, clearSegmentTimers, transition],
  );

  useEffect(() => {
    attachNativeListeners(SpeechRecognition.getRecognition());
    return () => detachNativeListenersRef.current();
  }, [attachNativeListeners]);

  useEffect(() => {
    if (!roomId || !enabled) {
      startInFlightRef.current = false;
      clearRecognitionTimers();
      clearSegmentTimers();
      clearDeliveryTimer();
      pendingDeliveryTextRef.current = "";
      resetSessionCursor();
      endDispositionRef.current = "disabled";
      transition({ type: "disable" });
      if (listeningRef.current) stopListeningSafely();
      return;
    }

    if (!browserSupportsSpeechRecognition) {
      startInFlightRef.current = false;
      clearRecognitionTimers();
      clearSegmentTimers();
      clearDeliveryTimer();
      pendingDeliveryTextRef.current = "";
      resetSessionCursor();
      endDispositionRef.current = "disabled";
      transition({
        type: "block",
        message:
          "Este navegador não oferece reconhecimento de voz para as legendas.",
        retryable: false,
      });
      if (listeningRef.current) stopListeningSafely();
      return;
    }

    const nextLocale = toSpeechRecognitionLocale(language);
    const localeChanged = previousLocaleRef.current !== nextLocale;
    previousLocaleRef.current = nextLocale;

    if (localeChanged && listeningRef.current) {
      endDispositionRef.current = "normal";
      stopListeningSafely();
      return;
    }

    startRecognitionRef.current("automatic");
  }, [
    browserSupportsSpeechRecognition,
    clearRecognitionTimers,
    clearSegmentTimers,
    clearDeliveryTimer,
    enabled,
    language,
    roomId,
    resetSessionCursor,
    transition,
  ]);

  useEffect(() => {
    sessionTranscriptRef.current = transcript;
    sessionFinalTranscriptRef.current = finalTranscript;

    if (
      !desiredEnabledRef.current ||
      machineRef.current.status !== "listening"
    ) {
      clearSegmentTimers();
      return;
    }

    const cursor = Math.min(sentCursorRef.current, transcript.length);
    const hasNewText = transcript.slice(cursor).trim().length > 0;
    if (!hasNewText) return;

    const hasNewFinalResult =
      finalTranscript.length > 0 &&
      finalTranscript !== lastObservedFinalRef.current;
    lastObservedFinalRef.current = finalTranscript;

    if (hasNewFinalResult) {
      flushBufferRef.current("final");
      return;
    }

    if (continuousTimerRef.current === null) {
      continuousTimerRef.current = window.setTimeout(() => {
        continuousTimerRef.current = null;
        requestFinalizationRef.current();
      }, SPEECH_CONTINUOUS_FLUSH_MS);
    }

    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
    }
    silenceTimerRef.current = window.setTimeout(() => {
      silenceTimerRef.current = null;
      requestFinalizationRef.current();
    }, SPEECH_SILENCE_TIMEOUT_MS);
  }, [clearSegmentTimers, finalTranscript, transcript]);

  useEffect(() => {
    if (!roomId) return;

    return subscribeToSpeechTranslations({
      onTranslation: (translation) => {
        if (translation.roomId !== roomId) return;

        translationSequenceRef.current += 1;
        setTranslations((current) => [
          ...current,
          { ...translation, sequence: translationSequenceRef.current },
        ]);
        setDeliveryIssue(null);
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

  const retryRecognition = useCallback(() => {
    if (
      !desiredEnabledRef.current ||
      machineRef.current.issue?.retryable === false ||
      startInFlightRef.current
    ) {
      return;
    }

    clearRecognitionTimers();
    endDispositionRef.current = "normal";

    if (machineRef.current.status === "blocked") {
      const NativeSpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!NativeSpeechRecognition) return;

      SpeechRecognition.applyPolyfill(NativeSpeechRecognition);
      attachNativeListeners(SpeechRecognition.getRecognition());
    }

    startRecognitionRef.current("manual");
  }, [attachNativeListeners, clearRecognitionTimers]);

  useEffect(
    () => () => {
      clearRecognitionTimers();
      clearSegmentTimers();
      clearDeliveryTimer();
      pendingDeliveryTextRef.current = "";
      startInFlightRef.current = false;
      detachNativeListenersRef.current();
      endDispositionRef.current = "disabled";
      if (listeningRef.current) stopListeningSafely();
    },
    [clearDeliveryTimer, clearRecognitionTimers, clearSegmentTimers],
  );

  return {
    translations,
    captionIssue:
      machine.status === "disabled" ? null : (machine.issue ?? deliveryIssue),
    retryRecognition,
  };
}
