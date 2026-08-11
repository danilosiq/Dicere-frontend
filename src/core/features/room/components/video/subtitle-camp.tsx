"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SelectorCountry } from "@/core/components";
import type { DeepLTargetLanguage } from "@/core/components";
import { IconButton } from "@/core/components/icon-button";
import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import type {
  CaptionIssue,
  ReceivedVoiceTranslation,
} from "@/core/hooks/use-speech-translation";
import { cn } from "@/core/utils/cn";
import { CircleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

export type SubtitleCampProps = {
  captionIssue: CaptionIssue | null;
  language: DeepLTargetLanguage;
  translations: ReceivedVoiceTranslation[];
  onLanguageChange: (language: DeepLTargetLanguage) => void;
  retryRecognition: () => void;
};

export function SubtitleCamp({
  captionIssue,
  language,
  translations,
  onLanguageChange,
  retryRecognition,
}: SubtitleCampProps) {
  const historyRef = useRef<HTMLDivElement>(null);
  const visibleTranslations = translations.slice(-3);
  const latestTranslation = translations[translations.length - 1];
  const issueButtonClassName = captionIssue
    ? cn(
        "shrink-0",
        captionIssue.status === "retry_wait"
          ? "bg-amber-100 text-amber-600 hover:bg-amber-200 hover:text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900 dark:hover:text-amber-300"
          : "bg-error/10 text-error hover:bg-error/20 hover:text-error dark:bg-error/20 dark:text-error-light dark:hover:bg-error/30 dark:hover:text-error-light",
      )
    : undefined;

  useEffect(() => {
    const history = historyRef.current;
    if (history) history.scrollTop = history.scrollHeight;
  }, [translations]);

  return (
    <Column className="absolute top-0 left-0 z-10 h-full min-h-0 w-[35%] rounded-t-md bg-linear-to-r from-black to-transparent">
      <Row className="w-full shrink-0 items-center gap-2 rounded-t-lg bg-white p-4 dark:bg-gray-800">
        <div className="min-w-0 flex-1">
          <SelectorCountry
            value={language}
            placeholder="Idioma falado"
            onSelect={onLanguageChange}
          />
        </div>

        {captionIssue?.retryable && (
          <IconButton
            ariaLabel={captionIssue.message}
            className={issueButtonClassName}
            icon={<CircleAlert />}
            onClick={retryRecognition}
            tooltip={captionIssue.message}
          />
        )}

        {captionIssue && !captionIssue.retryable && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={captionIssue.message}
                  className="shrink-0"
                  role="img"
                  tabIndex={0}
                >
                  <IconButton
                    ariaLabel={captionIssue.message}
                    className={issueButtonClassName}
                    disabled
                    icon={<CircleAlert />}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{captionIssue.message}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Row>

      <div
        aria-label="Legenda traduzida"
        className="flex min-h-0 flex-1 scrollbar-none flex-col gap-4 overflow-y-auto overscroll-contain px-4 [&::-webkit-scrollbar]:hidden"
        ref={historyRef}
        tabIndex={0}
      >
        {visibleTranslations.map((translation) => (
          <p
            key={`${translation.fromParticipantId}:${translation.segmentId ?? translation.sequence}`}
          >
            <Typography color="white">{translation.translatedText} </Typography>
          </p>
        ))}
      </div>

      <div
        aria-atomic="true"
        aria-label="Nova legenda traduzida"
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {latestTranslation?.translatedText}
      </div>
    </Column>
  );
}
