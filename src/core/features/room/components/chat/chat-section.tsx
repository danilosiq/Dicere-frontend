"use client";

import chatBackgroundBlack from "@/core/assets/images/chat-background-black.png";
import chatBackgroundWhite from "@/core/assets/images/chat-background-white.png";
import { SelectorCountry } from "@/core/components";
import { IconButton } from "@/core/components/icon-button";
import { InputText } from "@/core/components/input-text";
import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import { useMessageTranslations } from "@/core/hooks/use-message-translations";
import { useRoomChat } from "@/core/hooks/use-room-chat";
import { useRoomSessionStore } from "@/core/store/room-session-store";
import { ArrowDown, LoaderCircle, SendHorizonal } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type UIEvent,
} from "react";
import { ChatBalloon } from "./chat-balloon";

const NEAR_BOTTOM_THRESHOLD_PX = 96;

type PrependScrollSnapshot = {
  scrollHeight: number;
  scrollTop: number;
};

export function ChatSection() {
  const room = useRoomSessionStore((state) => state.room);
  const participant = useRoomSessionStore((state) => state.participant);
  const resumeSession = useRoomSessionStore((state) => state.resumeSession);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const didInitialScrollRef = useRef(false);
  const previousMessageRevisionRef = useRef<number | null>(null);
  const prependScrollSnapshotRef = useRef<PrependScrollSnapshot | null>(null);
  const [newMessageIndicator, setNewMessageIndicator] = useState<{
    roomId?: string;
    visible: boolean;
  }>({ roomId: room?.id, visible: false });
  const chat = useRoomChat({
    roomId: room?.id,
    participantId: participant?.id,
  });
  const translations = useMessageTranslations({
    roomId: room?.id,
    targetLanguage:
      participant?.targetLanguage ?? resumeSession?.targetLanguage,
  });
  const roomTitle = room?.title ?? resumeSession?.roomTitle ?? "Sala";
  const showNewMessageIndicator =
    newMessageIndicator.roomId === room?.id && newMessageIndicator.visible;

  useLayoutEffect(() => {
    didInitialScrollRef.current = false;
    previousMessageRevisionRef.current = null;
    prependScrollSnapshotRef.current = null;
    isNearBottomRef.current = true;
  }, [room?.id]);

  useLayoutEffect(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    const prependSnapshot = prependScrollSnapshotRef.current;
    const previousMessageRevision = previousMessageRevisionRef.current;
    previousMessageRevisionRef.current = chat.messageRevision;

    if (
      prependSnapshot &&
      chat.isLoadingOlder &&
      previousMessageRevision !== null &&
      previousMessageRevision !== chat.messageRevision
    ) {
      prependScrollSnapshotRef.current = {
        scrollHeight: viewport.scrollHeight,
        scrollTop: viewport.scrollTop,
      };
      return;
    }

    if (prependSnapshot && !chat.isLoadingOlder) {
      viewport.scrollTop =
        prependSnapshot.scrollTop +
        (viewport.scrollHeight - prependSnapshot.scrollHeight);
      prependScrollSnapshotRef.current = null;
      return;
    }

    if (
      !didInitialScrollRef.current &&
      chat.hasLoadedInitial &&
      !chat.isInitialLoading
    ) {
      viewport.scrollTop = viewport.scrollHeight;
      didInitialScrollRef.current = true;
      isNearBottomRef.current = true;
      setNewMessageIndicator({ roomId: room?.id, visible: false });
      return;
    }

    if (
      previousMessageRevision !== null &&
      previousMessageRevision !== chat.messageRevision
    ) {
      if (isNearBottomRef.current) {
        viewport.scrollTop = viewport.scrollHeight;
        setNewMessageIndicator({ roomId: room?.id, visible: false });
      } else {
        setNewMessageIndicator({ roomId: room?.id, visible: true });
      }
    }
  }, [
    chat.hasLoadedInitial,
    chat.isInitialLoading,
    chat.isLoadingOlder,
    chat.messageRevision,
    room?.id,
  ]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const sent = await chat.sendMessage();
    if (sent) {
      inputRef.current?.focus();
    }
  }

  function handleMessagesScroll(event: UIEvent<HTMLDivElement>) {
    const viewport = event.currentTarget;
    const remainingScroll =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = remainingScroll <= NEAR_BOTTOM_THRESHOLD_PX;

    isNearBottomRef.current = isNearBottom;
    if (isNearBottom) {
      setNewMessageIndicator({ roomId: room?.id, visible: false });
    }
  }

  function capturePrependScrollSnapshot() {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    prependScrollSnapshotRef.current = {
      scrollHeight: viewport.scrollHeight,
      scrollTop: viewport.scrollTop,
    };
  }

  async function handleLoadOlder() {
    capturePrependScrollSnapshot();
    const loaded = await chat.loadOlder();

    if (!loaded) {
      prependScrollSnapshotRef.current = null;
    }
  }

  async function handleRetryOlder() {
    capturePrependScrollSnapshot();
    const loaded = await chat.retryOlder();

    if (!loaded) {
      prependScrollSnapshotRef.current = null;
    }
  }

  function handleGoToLatestMessage() {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    viewport.scrollTop = viewport.scrollHeight;
    isNearBottomRef.current = true;
    setNewMessageIndicator({ roomId: room?.id, visible: false });
  }

  return (
    <Column className="h-[45%] min-h-0 w-full min-w-0 shrink-0 sm:h-auto sm:w-[40%] sm:min-w-80">
      <Row className="shrink-0 p-4">
        <Typography>{roomTitle}</Typography>
      </Row>
      <Column className="relative min-h-0 flex-1 overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center dark:hidden"
          style={{ backgroundImage: `url(${chatBackgroundWhite.src})` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 hidden bg-cover bg-center dark:block"
          style={{ backgroundImage: `url(${chatBackgroundBlack.src})` }}
        />

        <div
          aria-busy={chat.isInitialLoading || chat.isLoadingOlder}
          aria-label="Mensagens da sala"
          className="relative z-10 mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 pb-4"
          onScroll={handleMessagesScroll}
          ref={messagesViewportRef}
          role="log"
        >
          {chat.isLoadingOlder && (
            <div
              aria-live="polite"
              className="flex items-center justify-center gap-2 py-1 text-gray-500 dark:text-gray-300"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin"
              />
              <Typography size="sm">Carregando anteriores...</Typography>
            </div>
          )}

          {!chat.isLoadingOlder && chat.hasOlderMessages && (
            <button
              className="text-brand-purple dark:text-light-purple focus-visible:ring-primary-purple self-center rounded-md px-3 py-1 text-sm font-medium outline-none hover:underline focus-visible:ring-2"
              onClick={() => void handleLoadOlder()}
              type="button"
            >
              Carregar anteriores
            </button>
          )}

          {chat.olderError && (
            <div
              className="border-error bg-error-light dark:bg-error-dark flex items-center justify-between gap-3 rounded-lg border p-3"
              role="alert"
            >
              <Typography color="error" darkColor="white" size="sm">
                {chat.olderError}
              </Typography>
              <button
                className="text-error focus-visible:ring-error shrink-0 rounded px-2 py-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                onClick={() => void handleRetryOlder()}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {chat.isInitialLoading && (
            <div
              aria-live="polite"
              className="m-auto flex items-center justify-center gap-2 text-gray-500 dark:text-gray-300"
              role="status"
            >
              <LoaderCircle
                aria-hidden="true"
                className="size-5 animate-spin"
              />
              <Typography>Carregando histórico...</Typography>
            </div>
          )}

          {chat.initialError && (
            <div
              className="border-error bg-error-light dark:bg-error-dark m-auto flex flex-col items-center gap-2 rounded-lg border p-4 text-center"
              role="alert"
            >
              <Typography color="error" darkColor="white" size="sm">
                {chat.initialError}
              </Typography>
              <button
                className="text-error focus-visible:ring-error rounded px-2 py-1 text-sm font-semibold outline-none hover:underline focus-visible:ring-2"
                onClick={() => void chat.retryHistory()}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {!chat.isInitialLoading &&
          !chat.initialError &&
          chat.messages.length === 0 ? (
            <Typography className="m-auto text-center text-gray-500 dark:text-gray-300">
              Envie a primeira mensagem da sala.
            </Typography>
          ) : (
            chat.messages.map((message) => {
              const translation = translations.getTranslationState(message);

              return (
                <ChatBalloon
                  displayedContent={translation.displayedContent}
                  key={message.id}
                  message={message}
                  onRetryTranslation={() => {
                    void translations.retryTranslation(message);
                  }}
                  onShowOriginal={() => translations.showOriginal(message.id)}
                  onShowTranslation={() =>
                    translations.showTranslation(message.id)
                  }
                  onTranslate={() => {
                    void translations.translate(message);
                  }}
                  role={
                    message.participantId === participant?.id
                      ? "sender"
                      : "receiver"
                  }
                  translation={translation}
                />
              );
            })
          )}
        </div>

        {showNewMessageIndicator && (
          <button
            className="bg-primary-purple hover:bg-primary-purple/90 focus-visible:ring-primary-purple absolute bottom-24 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full px-3 py-2 text-sm font-medium text-white shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            onClick={handleGoToLatestMessage}
            type="button"
          >
            <ArrowDown aria-hidden="true" className="size-4" />
            Novas mensagens
          </button>
        )}

        <form
          className="relative z-10 flex shrink-0 items-start gap-1 rounded-lg p-2"
          onSubmit={handleSubmit}
        >
          <Column className="min-w-0 flex-1">
            <InputText
              aria-label="Mensagem"
              disabled={!room?.id || !participant?.id}
              error={chat.validationError ?? chat.sendError ?? undefined}
              onChange={(event) => chat.setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="Escreva uma mensagem..."
              ref={inputRef}
              value={chat.draft}
            />

            <Row className="justify-end px-1 pt-1">
              <Typography
                className={
                  chat.characterCount > 250
                    ? "text-error"
                    : "text-gray-500 dark:text-gray-300"
                }
                size="xs"
              >
                {chat.characterCount}/250
              </Typography>
            </Row>
            {!chat.isConnected && (
              <Typography
                className="px-1"
                color="error"
                darkColor="white"
                size="sm"
              >
                Chat desconectado. Aguarde a reconexão para enviar.
              </Typography>
            )}
          </Column>
          <SelectorCountry
            hideLabelText
            value={chat.sourceLanguage}
            placeholder="Idioma falado"
            onSelect={chat.setSourceLanguage}
          />
          <IconButton
            ariaBusy={chat.isSending}
            ariaLabel={chat.isSending ? "Enviando mensagem" : "Enviar mensagem"}
            className="mt-0.5"
            disabled={!chat.canSend}
            icon={
              chat.isSending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <SendHorizonal />
              )
            }
            type="submit"
          />
          {chat.isSending && (
            <span aria-live="polite" className="sr-only" role="status">
              Enviando mensagem.
            </span>
          )}
        </form>
      </Column>
    </Column>
  );
}
