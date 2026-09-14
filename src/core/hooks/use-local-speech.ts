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
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  useEffect(() => {
    if (!enabled || !roomId) return;
    let active = true;
    const engine = new LocalSpeechEngine({
      locale,
      onText: (text) => {
        if (active) onTextRef.current(text);
      },
      onStage: (stage) => {
        if (!active) return;
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
        if (!active) return;
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
    void engine.start();
    return () => {
      active = false;
      engine.stop();
    };
  }, [enabled, roomId, locale, attempt]);

  const retryRecognition = useCallback(() => {
    if (issue?.retryable) setAttempt((current) => current + 1);
  }, [issue]);
  return { captionIssue: enabled && roomId ? issue : null, retryRecognition };
}
