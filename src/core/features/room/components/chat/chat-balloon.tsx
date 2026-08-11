import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import type { ChatMessage } from "@/core/@types/chat";
import type { MessageTranslationViewState } from "@/core/hooks/use-message-translations";
import { format, isValid, parseISO } from "date-fns";
import { Languages } from "lucide-react";
import { useId } from "react";

interface ChatBalloonProps {
  message: ChatMessage;
  role: "sender" | "receiver";
  displayedContent?: string;
  translation?: MessageTranslationViewState;
  onTranslate?: () => void;
  onShowOriginal?: () => void;
  onShowTranslation?: () => void;
  onRetryTranslation?: () => void;
}

function formatMessageTime(createdAt: string) {
  const date = parseISO(createdAt);

  return isValid(date) ? format(date, "HH:mm") : "--:--";
}

export function ChatBalloon({
  message,
  role,
  displayedContent = message.content,
  translation,
  onTranslate,
  onShowOriginal,
  onShowTranslation,
  onRetryTranslation,
}: ChatBalloonProps) {
  const isSender = role === "sender";
  const translationReasonId = useId();
  const balloonVariant = isSender
    ? "bg-primary-green rounded-tl-lg"
    : "bg-primary-purple rounded-tr-lg";
  const translationLabel = translation?.isLoading
    ? "Traduzindo..."
    : translation?.error
      ? "Tentar novamente"
      : translation?.displayMode === "translated"
        ? "Ver original"
        : translation?.hasTranslation
          ? "Ver tradução"
          : "Traduzir";

  function handleTranslationAction() {
    if (
      !translation ||
      translation.isLoading ||
      Boolean(translation.disabledReason)
    ) {
      return;
    }

    if (translation.error) {
      onRetryTranslation?.();
      return;
    }

    if (translation.displayMode === "translated") {
      onShowOriginal?.();
      return;
    }

    if (translation.hasTranslation) {
      onShowTranslation?.();
      return;
    }

    onTranslate?.();
  }

  return (
    <Column className={`max-w-[85%] ${isSender ? "self-end" : "self-start"}`}>
      <Column className={`${balloonVariant} rounded-b-lg p-3`}>
        <Typography
          fontFamily="baloo2"
          size={"lg"}
          className={isSender ? "text-end" : "text-start"}
          fontWeight="semibold"
          color="white"
        >
          {message.participantName}
        </Typography>

        <Typography
          className="[overflow-wrap:anywhere] break-words whitespace-pre-wrap"
          color="white"
          size={"sm"}
        >
          {displayedContent}
        </Typography>
        <Row className={`mt-1 ${isSender ? "justify-start" : "justify-end"}`}>
          <Typography className="text-white/80" size="xs">
            {formatMessageTime(message.createdAt)}
          </Typography>
        </Row>
      </Column>
      {translation && (
        <Column className={isSender ? "items-end" : "items-start"}>
          <button
            aria-describedby={
              translation.disabledReason ? translationReasonId : undefined
            }
            aria-busy={translation.isLoading}
            aria-disabled={Boolean(translation.disabledReason)}
            aria-label={`${translationLabel} mensagem de ${message.participantName}`}
            className={`focus-visible:ring-primary-purple mt-1 flex items-center gap-1 rounded px-1 text-sm outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 ${
              isSender
                ? "text-primary-green dark:text-white"
                : "text-primary-purple dark:text-white"
            }`}
            disabled={translation.isLoading}
            onClick={handleTranslationAction}
            type="button"
          >
            <Languages aria-hidden="true" className="size-4" />
            {translationLabel}
          </button>
          {translation.isLoading && (
            <span aria-live="polite" className="sr-only" role="status">
              Traduzindo mensagem de {message.participantName}.
            </span>
          )}
          {translation.disabledReason && (
            <Typography
              className="max-w-64 text-gray-500 dark:text-gray-300"
              size="xs"
            >
              <span id={translationReasonId}>{translation.disabledReason}</span>
            </Typography>
          )}
          {translation.error && (
            <div className="max-w-64" role="alert">
              <Typography color="error" darkColor="white" size="xs">
                {translation.error}
              </Typography>
            </div>
          )}
        </Column>
      )}
    </Column>
  );
}
