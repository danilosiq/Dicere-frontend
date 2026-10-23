type Transcriber = (
  audio: Float32Array,
  options: {
    language: string;
    task: "transcribe";
    max_new_tokens: number;
    do_sample: false;
    return_timestamps: false;
  },
) => Promise<{ text: string } | { text: string }[]>;

/** Admit audio before ASR; never blacklist legitimate words such as "Obrigado". */
export async function transcribeLocalSpeech(
  audio: Float32Array,
  locale: string,
  vad: { hasSpeech: (audio: Float32Array) => Promise<boolean> },
  transcriber: Transcriber,
): Promise<string> {
  if (!(await vad.hasSpeech(audio))) return "";
  const baseLanguage = locale.toLowerCase().split("-")[0];
  const output = await transcriber(audio, {
    language: baseLanguage === "nb" ? "no" : baseLanguage,
    task: "transcribe",
    max_new_tokens: 128,
    do_sample: false,
    return_timestamps: false,
  });
  const text = (Array.isArray(output) ? output[0] : output).text.trim();
  // Whisper can label nonverbal vocalizations as sound effects. An output made
  // entirely of annotations is not spoken text and must not reach translation.
  const words = text.replace(/\[[^\]]*\]|\([^)]*\)|[♪♫]+/gu, "").trim();
  return words ? text : "";
}
