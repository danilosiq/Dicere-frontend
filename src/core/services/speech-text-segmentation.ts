export const MAX_SPEECH_TRANSLATION_CHARACTERS = 250;

function sentenceEnds(text: string): number[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
    return Array.from(
      segmenter.segment(text),
      ({ index, segment }) => index + segment.trimEnd().length,
    );
  }

  // Older supported browsers lack Segmenter: use punctuation conservatively.
  // Decimal points without following whitespace are not sentence boundaries.
  return Array.from(
    text.matchAll(/[.!?。！？]+["'”’»」』)]*(?:\s+|$)/g),
    (match) => match.index + match[0].trimEnd().length,
  );
}

/** Prefer complete sentences; normalize only whitespace, never truncate content. */
export function splitSpeechText(
  text: string,
  limit = MAX_SPEECH_TRANSLATION_CHARACTERS,
): string[] {
  // At least two UTF-16 code units are needed to preserve an astral character.
  if (!Number.isInteger(limit) || limit < 2) {
    throw new RangeError("Speech text limit must be an integer of at least 2.");
  }

  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return [];
  if (normalized.length <= limit) return [normalized];

  const ends = sentenceEnds(normalized);
  const chunks: string[] = [];
  let start = 0;
  let boundaryIndex = 0;

  while (normalized.length - start > limit) {
    const maxEnd = start + limit;
    let end = start;
    while (boundaryIndex < ends.length && ends[boundaryIndex] <= maxEnd) {
      end = Math.max(end, ends[boundaryIndex++]);
    }
    if (end <= start) {
      end = normalized.lastIndexOf(" ", maxEnd);
      if (end <= start) end = maxEnd;
      // A long word may contain emoji or another surrogate pair.
      if (/[\uD800-\uDBFF]/.test(normalized[end - 1])) end--;
    }
    chunks.push(normalized.slice(start, end).trim());
    start = end;
    while (normalized[start] === " ") start++;
  }

  if (start < normalized.length) chunks.push(normalized.slice(start));
  return chunks;
}
