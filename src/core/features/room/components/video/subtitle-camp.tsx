"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SelectorCountry } from "@/core/components";
import { isDeepLTargetLanguage } from "@/core/components/selector-country/countryList";
import type { DeepLTargetLanguage } from "@/core/components";
import { IconButton } from "@/core/components/icon-button";
import { Column, Row } from "@/core/components/layout";
import { Typography } from "@/core/components/typography";
import type {
  CaptionIssue,
  ReceivedVoiceTranslation,
} from "@/core/hooks/use-speech-translation";
import { cn } from "@/core/utils/cn";
import {
  getSpeechTranslationMetrics,
  recordSpeechTranslationMetric,
} from "@/core/services/speech-translation-service";
import { CircleAlert } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import {
  scrollToCaption,
  selectCaptionPresentation,
} from "./subtitle-presentation";

export type SubtitleCampProps = {
  captionIssue: CaptionIssue | null;
  language: DeepLTargetLanguage;
  targetLanguage?: string | null;
  onTargetLanguageChange?: (language: DeepLTargetLanguage) => void;
  isUpdatingTargetLanguage?: boolean;
  targetLanguageError?: string;
  translations: ReceivedVoiceTranslation[];
  onLanguageChange: (language: DeepLTargetLanguage) => void;
  retryRecognition: () => void;
};

export function SubtitleCamp({
  captionIssue,
  language,
  targetLanguage,
  onTargetLanguageChange,
  isUpdatingTargetLanguage,
  targetLanguageError,
  translations,
  onLanguageChange,
  retryRecognition,
}: SubtitleCampProps) {
  const { t, feedback } = useSiteLanguage();
  const historyRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(new Set<string>());
  const followLatestRef = useRef(true);
  const { visibleTranslations, latestTranslation } =
    selectCaptionPresentation(translations);
  const issueButtonClassName = captionIssue
    ? cn(
        "shrink-0",
        captionIssue.status === "retry_wait"
          ? "bg-amber-100 text-amber-600 hover:bg-amber-200 hover:text-amber-700 dark:bg-amber-950 dark:text-amber-400 dark:hover:bg-amber-900 dark:hover:text-amber-300"
          : "bg-error/10 text-error hover:bg-error/20 hover:text-error dark:bg-error/20 dark:text-error-light dark:hover:bg-error/30 dark:hover:text-error-light",
      )
    : undefined;

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!translations.length) {
      followLatestRef.current = true;
      renderedRef.current.clear();
    }
    if (history && followLatestRef.current)
      scrollToCaption(history, latestTranslation);
  }, [latestTranslation, translations.length]);

  useLayoutEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    const metrics = getSpeechTranslationMetrics();
    for (const translation of visibleTranslations) {
      if (!translation.segmentId || !translation.traceId) continue;
      const key = `${translation.fromParticipantId}:${translation.segmentId}:${translation.revision ?? 0}:${translation.status ?? "final"}`;
      if (renderedRef.current.has(key)) continue;
      const inDom = Array.from(history.children).some(
        (element) =>
          element.getAttribute("data-speech-segment-id") ===
            translation.segmentId &&
          element.getAttribute("data-speech-participant-id") ===
            translation.fromParticipantId,
      );
      if (!inDom) continue;
      const renderedAt = performance.now();
      const received = metrics.findLast(
        (metric) =>
          metric.name === "receive" &&
          metric.segmentId === translation.segmentId &&
          metric.traceId === translation.traceId,
      );
      recordSpeechTranslationMetric({
        name: "render",
        observedAt: renderedAt,
        segmentId: translation.segmentId,
        traceId: translation.traceId,
        ...(received ? { durationMs: renderedAt - received.observedAt } : {}),
      });
      renderedRef.current.add(key);
    }
  }, [visibleTranslations]);

  return (
    <Column className="absolute top-0 bottom-0 left-0 z-10 min-h-0 w-[55%] rounded-t-md bg-linear-to-r from-black to-transparent sm:w-[40%] lg:w-[35%]">
      <Row className="w-full shrink-0 items-center gap-2 rounded-t-lg bg-white p-4 dark:bg-gray-800">
        <Column className="min-w-0 flex-1">
          <SelectorCountry
            value={language}
            label={t("Seu idioma falado")}
            placeholder={t("Idioma falado")}
            onSelect={onLanguageChange}
          />
          <Column className="mt-2">
            <SelectorCountry
              value={
                isDeepLTargetLanguage(targetLanguage)
                  ? targetLanguage
                  : undefined
              }
              label={t("Idioma que está traduzindo")}
              placeholder={targetLanguage ?? t("Selecione o idioma")}
              onSelect={onTargetLanguageChange ?? (() => {})}
              disabled={!onTargetLanguageChange || isUpdatingTargetLanguage}
              error={targetLanguageError}
            />
          </Column>
        </Column>

        {captionIssue?.retryable && (
          <IconButton
            ariaLabel={feedback(captionIssue.message)}
            className={issueButtonClassName}
            icon={<CircleAlert />}
            onClick={retryRecognition}
            tooltip={feedback(captionIssue.message)}
          />
        )}

        {captionIssue && !captionIssue.retryable && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  aria-label={feedback(captionIssue.message)}
                  className="shrink-0"
                  role="img"
                  tabIndex={0}
                >
                  <IconButton
                    ariaLabel={feedback(captionIssue.message)}
                    className={issueButtonClassName}
                    disabled
                    icon={<CircleAlert />}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>{feedback(captionIssue.message)}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </Row>

      <div
        aria-label={t("Legenda traduzida")}
        className="flex min-h-0 flex-1 [scrollbar-width:none] flex-col gap-4 overflow-y-auto overscroll-contain px-4 py-4 [&::-webkit-scrollbar]:hidden"
        onScroll={(event) => {
          const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
          followLatestRef.current =
            scrollHeight - scrollTop - clientHeight <= 48;
        }}
        ref={historyRef}
        tabIndex={0}
      >
        {visibleTranslations.map((translation) => (
          <p
            className="shrink-0 wrap-break-word whitespace-pre-wrap"
            key={`${translation.fromParticipantId}:${translation.segmentId ?? translation.sequence}`}
            data-speech-segment-id={translation.segmentId}
            data-speech-participant-id={translation.fromParticipantId}
            data-speech-sequence={translation.sequence}
          >
            <Typography color="white">{translation.translatedText} </Typography>
          </p>
        ))}
      </div>

      <div
        aria-atomic="true"
        aria-label={t("Nova legenda traduzida")}
        aria-live="polite"
        className="sr-only"
        role="status"
      >
        {latestTranslation?.translatedText}
      </div>
    </Column>
  );
}
