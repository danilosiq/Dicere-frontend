"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  LocalSpeechEngine,
  type LocalSpeechFailure,
} from "@/core/services/local-speech-engine";
import { reportSpeechRecognitionDiagnostic } from "@/core/services/speech-recognition-service";

export type LocalCaptionIssue = {
  status: "retry_wait" | "blocked";
  message: string;
  retryable: boolean;
};

function failureMessage({ stage, errorName }: LocalSpeechFailure) {
  if (errorName === "NotAllowedError")
    return "Libere o microfone e tente novamente. Se necessário, clique na página para ativar o áudio.";
  if (errorName === "LocalSpeechUnsupported")
    return "Este navegador não oferece os recursos necessários para transcrição local. Use um navegador atualizado em HTTPS.";
  if (
    errorName === "TranscriptionTooSlow" ||
    errorName === "TranscriptionTimeout"
  )
    return "Este dispositivo não conseguiu acompanhar a transcrição. Feche outras abas e tente novamente.";
  if (stage === "loading")
    return "Não foi possível carregar o modelo de voz. Verifique a conexão e tente novamente.";
  if (stage === "microphone" || errorName === "MicrophoneEnded")
    return "Não foi possível manter o microfone ativo. Verifique o dispositivo e tente novamente.";
  return "A transcrição local foi interrompida. Tente novamente.";
}

export function useLocalSpeech({
  roomId,
  locale,
  enabled,
  onText,
}: {
  roomId?: string;
  locale: string;
  enabled: boolean;
  onText: (text: string) => void;
}) {
  const [issue, setIssue] = useState<LocalCaptionIssue | null>(null);
  const [attempt, setAttempt] = useState(0);
  const scopeKey = `${roomId ?? ""}:${locale}:${attempt}`;
  const [issueScope, setIssueScope] = useState(scopeKey);
  if (issueScope !== scopeKey) {
    setIssueScope(scopeKey);
    setIssue(null);
  }
  const onTextRef = useRef(onText);
  const scopeRef = useRef<{
    active: boolean;
    engines: Set<LocalSpeechEngine>;
    drain: Promise<void> | null;
  } | null>(null);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    const scope = {
      active: true,
      engines: new Set<LocalSpeechEngine>(),
      drain: null as Promise<void> | null,
    };
    scopeRef.current = scope;
    return () => {
      scope.active = false;
      scope.engines.forEach((engine) => engine.stop());
      scope.engines.clear();
      if (scopeRef.current === scope) scopeRef.current = null;
    };
  }, [roomId, locale, attempt]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    const scope = scopeRef.current;
    if (!scope) return;
    let active = true;
    let engine: LocalSpeechEngine | undefined;
    const start = () => {
      if (!active || !scope.active) return;
      engine = new LocalSpeechEngine({
        locale,
        onText: (text) => {
          if (scope.active && scope.engines.has(engine!))
            onTextRef.current(text);
        },
        onStage: (stage) => {
          if (!active || !scope.active) return;
          setIssue(
            stage === "listening"
              ? null
              : {
                  status: "retry_wait",
                  message:
                    stage === "loading"
                      ? "Preparando o modelo de voz no dispositivo. O primeiro carregamento pode demorar…"
                      : "Ativando o microfone. Autorize o acesso se solicitado…",
                  retryable: false,
                },
          );
        },
        onError: (failure) => {
          if (!scope.active || !scope.engines.has(engine!)) return;
          setIssue({
            status: "blocked",
            message: failureMessage(failure),
            retryable: failure.errorName !== "LocalSpeechUnsupported",
          });
          // No speech text/audio: only the stage and technical error identifier.
          console.error("[Dicere][LocalSpeech]", {
            engine: "transformers-whisper-tiny",
            ...failure,
            locale,
            retryAttempt: attempt,
          });
          void reportSpeechRecognitionDiagnostic({
            code:
              failure.errorName === "NotAllowedError"
                ? "not-allowed"
                : failure.errorName === "LocalSpeechUnsupported"
                  ? "unsupported-browser"
                  : failure.stage === "microphone"
                    ? "audio-capture"
                    : "start-failed",
            errorName: failure.errorName,
            locale,
            mode: "on-device",
            retryAttempt: attempt,
            stage: failure.stage === "loading" ? "start" : "runtime",
          });
        },
      });
      scope.engines.add(engine);
      void engine.start();
    };
    if (scope.drain) {
      setIssue({
        status: "retry_wait",
        message: "Concluindo a transcrição anterior…",
        retryable: false,
      });
      void scope.drain.then(start);
    } else {
      start();
    }
    return () => {
      active = false;
      if (!engine) return;
      if (scope.active) {
        const drainingEngine = engine;
        const drain = drainingEngine.finishClosedSegments();
        scope.drain = drain;
        void drain.finally(() => {
          scope.engines.delete(drainingEngine);
          if (scope.drain === drain) scope.drain = null;
        });
      } else {
        scope.engines.delete(engine);
      }
    };
  }, [enabled, roomId, locale, attempt]);

  const retryRecognition = useCallback(() => {
    if (issue?.retryable) setAttempt((current) => current + 1);
  }, [issue]);
  return {
    captionIssue:
      roomId && (enabled || issue?.status === "blocked") ? issue : null,
    retryRecognition,
  };
}
