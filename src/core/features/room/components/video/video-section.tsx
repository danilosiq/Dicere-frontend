"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

import { Row } from "@/core/components/layout";
import { MediaStreamVideo } from "@/core/components/media-stream-video";
import { Typography } from "@/core/components/typography";
import type { CallSession } from "@/core/hooks/use-call-session";
import { useSpeechTranslation } from "@/core/hooks/use-speech-translation";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import {
  isSpeechSourceLanguageSupported,
  speechSourceLanguageMessage,
} from "@/core/utils/speech-recognition-language";
import { LoaderCircle, UserRound, VideoOff } from "lucide-react";
import { useState } from "react";
import { SubtitleCamp } from "./subtitle-camp";
import { SpeechPrivacyNotice } from "./speech-privacy-notice";
import { isServerSpeechEnabled } from "@/core/services/server-speech/config";
import { useTranslationLanguage } from "@/core/hooks/use-translation-language";

export function VideoSection({ call }: { call: CallSession }) {
  const { t, feedback } = useSiteLanguage();
  const room = useRoomSessionStore((state) => state.room);
  const participant = useRoomSessionStore((state) => state.participant);
  const [acceptedSpeechRoom, setAcceptedSpeechRoom] = useState<string>();
  const speechLanguage = useRoomSessionStore((state) => state.spokenLanguage);
  const setSpeechLanguage = useRoomSessionStore(
    (state) => state.setSpokenLanguage,
  );
  const targetLanguage = useTranslationLanguage(room?.id, participant?.id);
  const needsSpeechConsent =
    isServerSpeechEnabled(room?.id, speechLanguage) &&
    acceptedSpeechRoom !== room?.id;
  const speechSourceSupported = isSpeechSourceLanguageSupported(speechLanguage);
  const speechTranslation = useSpeechTranslation({
    // Leaving cancels the session; mute only finishes already closed speech.
    roomId: call.isLeaving ? undefined : room?.id,
    language: speechLanguage,
    enabled:
      Boolean(room?.id) &&
      call.microphoneEnabled &&
      !call.isLeaving &&
      !needsSpeechConsent &&
      speechSourceSupported,
  });
  const remoteParticipant = room?.participants.find(
    ({ id }) => id !== participant?.id,
  );
  const hasRemoteVideo =
    call.remoteStream
      ?.getVideoTracks()
      .some((track) => track.readyState === "live") ?? false;

  const remoteStatus = call.isError
    ? call.errorMessage
      ? feedback(call.errorMessage)
      : undefined
    : call.isStarting
      ? t("Preparando sua câmera e seu microfone...")
      : call.isWaitingForParticipant
        ? t("Aguardando o outro participante...")
        : t("Conectando o vídeo do outro participante...");

  return (
    <Row className="relative min-h-0 flex-1 bg-gray-100 p-4 dark:bg-black">
      <Row className="relative min-w-0 flex-1 overflow-hidden rounded-xl border-2 dark:bg-gray-900">
        {needsSpeechConsent && room && (
          <SpeechPrivacyNotice
            onAccept={() => setAcceptedSpeechRoom(room.id)}
          />
        )}
        <SubtitleCamp
          captionIssue={
            speechSourceSupported
              ? speechTranslation.captionIssue
              : {
                  status: "blocked",
                  message: speechSourceLanguageMessage(speechLanguage),
                  retryable: false,
                }
          }
          language={speechLanguage}
          targetLanguage={participant?.targetLanguage}
          onTargetLanguageChange={targetLanguage.changeLanguage}
          isUpdatingTargetLanguage={targetLanguage.isUpdating}
          targetLanguageError={targetLanguage.error}
          translations={speechTranslation.translations}
          onLanguageChange={setSpeechLanguage}
          retryRecognition={speechTranslation.retryRecognition}
        />
        <MediaStreamVideo
          className="min-w-0 flex-1 rounded-xl"
          label={t("Vídeo do outro participante")}
          stream={call.remoteStream}
        />

        {!hasRemoteVideo && (
          <div
            aria-live="polite"
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gray-300 px-6 text-center dark:bg-gray-900"
          >
            {call.isError ? (
              <VideoOff aria-hidden="true" className="size-10 text-white" />
            ) : call.isStarting || !call.isWaitingForParticipant ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-10 animate-spin text-white"
              />
            ) : (
              <UserRound aria-hidden="true" className="size-10 text-white" />
            )}
            <Typography className="text-white">
              {remoteStatus ?? t("Não foi possível iniciar a chamada.")}
            </Typography>
            {call.isError && (
              <button
                className="bg-primary-purple hover:bg-primary-purple/90 rounded-full px-4 py-2 text-sm font-medium text-white"
                onClick={() => void call.retryCall()}
                type="button"
              >
                {t("Tentar novamente")}
              </button>
            )}
          </div>
        )}

        <Row className="bg-primary-purple absolute top-0 right-0 z-10 min-w-[30%] rounded-tr-xl rounded-bl-xl px-3 py-3">
          <Typography className="text-white">
            {remoteParticipant?.name ?? t("Outro participante")}
          </Typography>
        </Row>

        <MediaStreamVideo
          mirrored
          muted
          className="absolute right-4 bottom-4 z-10 h-[25%] w-[25%] rounded-xl"
          label={t("Seu vídeo")}
          stream={call.localStream}
        />
      </Row>
    </Row>
  );
}
