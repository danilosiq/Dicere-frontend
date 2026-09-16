"use client";

import { useCallback, useEffect, useState } from "react";
import { ServerSpeechEngine } from "@/core/services/server-speech/engine";
import type { LocalCaptionIssue } from "./use-local-speech";

function messageFor(code: string) {
  if (code === "STT_LANGUAGE_UNSUPPORTED")
    return "O novo reconhecimento está em teste apenas para português brasileiro. Selecione PT-BR como idioma falado.";
  if (code === "STT_PERMISSION_DENIED")
    return "Autorize o microfone para transcrever sua fala.";
  if (code === "STT_BACKGROUND_PAUSED")
    return "Transcrição pausada em segundo plano. Volte à sala e tente novamente.";
  if (code === "STT_UTTERANCE_TOO_LONG")
    return "Este teste ainda não aceita falas contínuas acima de 12 segundos. Faça uma pausa e tente novamente.";
  if (code === "STT_DISCONNECTED")
    return "A conexão de voz foi interrompida. Aguarde a reconexão da sala e tente novamente.";
  return "Não foi possível acompanhar a transcrição. Tente novamente.";
}

export function useServerSpeech({
  roomId,
  locale,
  enabled,
}: {
  roomId?: string;
  locale: string;
  enabled: boolean;
}) {
  const [issue, setIssue] = useState<LocalCaptionIssue | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled || !roomId) return;
    let active = true;
    const engine = new ServerSpeechEngine({
      roomId,
      locale,
      onStage: (stage) => {
        if (active)
          setIssue(
            stage === "listening"
              ? null
              : {
                  status: "retry_wait",
                  retryable: false,
                  message:
                    stage === "preparing"
                      ? "Verificando o serviço de voz do Dicere…"
                      : "Ativando o microfone…",
                },
          );
      },
      onError: (code) => {
        if (!active) return;
        setIssue({
          status: "blocked",
          message: messageFor(code),
          retryable: code !== "STT_LANGUAGE_UNSUPPORTED",
        });
        console.error("[Dicere][ServerSpeech]", {
          code,
          locale,
          retryAttempt: attempt,
        });
      },
    });
    void engine.start();
    return () => {
      active = false;
      engine.stop();
    };
  }, [roomId, locale, enabled, attempt]);
  const retryRecognition = useCallback(() => {
    if (issue?.retryable) setAttempt((current) => current + 1);
  }, [issue]);
  return { captionIssue: enabled ? issue : null, retryRecognition };
}
