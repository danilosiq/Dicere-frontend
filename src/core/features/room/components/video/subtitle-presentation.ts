import type { ReceivedVoiceTranslation } from "@/core/hooks/use-speech-translation";

function arrivalOrder(translation: ReceivedVoiceTranslation) {
  return translation.receivedOrder ?? translation.sequence;
}

export function selectCaptionPresentation(
  translations: ReceivedVoiceTranslation[],
) {
  const byArrival = [...translations].sort(
    (left, right) => arrivalOrder(left) - arrivalOrder(right),
  );
  return {
    visibleTranslations: [...translations].sort(
      (left, right) => left.sequence - right.sequence,
    ),
    latestTranslation: byArrival.at(-1),
  };
}

export function scrollToCaption(
  history: HTMLElement,
  latest: ReceivedVoiceTranslation | undefined,
) {
  if (!latest) return;
  const row = Array.from(history.children).find(
    (element) =>
      element.getAttribute("data-speech-participant-id") ===
        latest.fromParticipantId &&
      (latest.segmentId
        ? element.getAttribute("data-speech-segment-id") === latest.segmentId
        : element.getAttribute("data-speech-sequence") ===
          String(latest.sequence)),
  );
  if (!row) return;
  if (row === history.lastElementChild) {
    history.scrollTop = history.scrollHeight;
    return;
  }
  history.scrollTop +=
    row.getBoundingClientRect().top -
    history.getBoundingClientRect().top -
    history.clientTop;
}
