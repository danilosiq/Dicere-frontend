"use client";

import {
  Mic,
  MicOff,
  PhoneOff,
  RefreshCw,
  Video,
  VideoOff,
} from "lucide-react";

import { IconButton } from "@/core/components/icon-button";
import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";

import { MediaStreamVideo } from "./components/media-stream-video";
import { useCallSession } from "./hooks/use-call-session";

export type CallExperienceProps = {
  title?: string;
  onLeave?: () => void;
};

function getConnectionLabel({
  isStarting,
  isWaitingForParticipant,
  isConnected,
  isError,
}: {
  isStarting: boolean;
  isWaitingForParticipant: boolean;
  isConnected: boolean;
  isError: boolean;
}) {
  if (isError) {
    return "Falha na conexão";
  }

  if (isConnected) {
    return "Conectado";
  }

  if (isWaitingForParticipant) {
    return "Aguardando o outro participante";
  }

  return isStarting ? "Preparando câmera e microfone" : "Conectando";
}

export function CallExperience({
  title = "Chamada Dicere",
  onLeave,
}: CallExperienceProps) {
  const call = useCallSession();
  const connectionLabel = getConnectionLabel(call);

  const handleLeave = () => {
    call.leaveCall();
    onLeave?.();
  };

  return (
    <Column className="bg-background text-foreground min-h-screen gap-5 p-4 sm:p-6">
      <Row className="items-center justify-between gap-4">
        <Column>
          <Typography fontFamily="baloo2" fontWeight="semibold" size="xl">
            {title}
          </Typography>
          <Typography
            aria-live="polite"
            className="text-gray-400 dark:text-gray-200"
            size="sm"
          >
            {connectionLabel}
          </Typography>
        </Column>

        {call.isError && (
          <IconButton
            ariaLabel="Tentar reconectar"
            icon={<RefreshCw />}
            tooltip="Tentar reconectar"
            onClick={() => void call.retryCall()}
          />
        )}
      </Row>

      {call.errorMessage && (
        <div
          aria-live="assertive"
          className="border-error bg-error-light text-error-dark dark:border-error-light dark:bg-error-dark dark:text-error-light rounded-xl border px-4 py-3"
          role="alert"
        >
          {call.errorMessage}
        </div>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.32fr)]">
        <div className="border-border relative min-h-80 overflow-hidden rounded-2xl border bg-gray-900">
          {call.remoteStream ? (
            <MediaStreamVideo
              label="Vídeo do outro participante"
              stream={call.remoteStream}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center px-6 text-center text-gray-100">
              <Typography>{connectionLabel}</Typography>
            </div>
          )}
        </div>

        <div className="border-border bg-component relative min-h-48 overflow-hidden rounded-2xl border lg:min-h-0">
          {call.localStream && call.cameraEnabled ? (
            <MediaStreamVideo
              mirrored
              muted
              label="Seu vídeo"
              stream={call.localStream}
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-gray-400 dark:text-gray-200">
              <Typography>Sua câmera está desligada</Typography>
            </div>
          )}
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            Você
          </span>
        </div>
      </div>

      <Row className="bg-component border-border mx-auto items-center gap-2 rounded-full border p-2 shadow-sm">
        <IconButton
          ariaLabel={
            call.microphoneEnabled ? "Desativar microfone" : "Ativar microfone"
          }
          className={!call.microphoneEnabled ? "bg-error/15 text-error" : ""}
          disabled={!call.hasMicrophone}
          icon={call.microphoneEnabled ? <Mic /> : <MicOff />}
          tooltip={
            call.microphoneEnabled ? "Desativar microfone" : "Ativar microfone"
          }
          onClick={call.toggleMicrophone}
        />
        <IconButton
          ariaLabel={call.cameraEnabled ? "Desativar câmera" : "Ativar câmera"}
          className={!call.cameraEnabled ? "bg-error/15 text-error" : ""}
          disabled={!call.hasCamera}
          icon={call.cameraEnabled ? <Video /> : <VideoOff />}
          tooltip={call.cameraEnabled ? "Desativar câmera" : "Ativar câmera"}
          onClick={call.toggleCamera}
        />
        <IconButton
          ariaLabel="Sair da chamada"
          className="bg-error hover:bg-error/90 text-white"
          disabled={call.isLeaving}
          icon={<PhoneOff />}
          tooltip="Sair da chamada"
          onClick={handleLeave}
        />
      </Row>
    </Column>
  );
}
