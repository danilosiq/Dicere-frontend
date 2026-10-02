export const serverSpeechLocales = [
  "pt-BR",
  "en-US",
  "en-GB",
  "es-ES",
  "zh-CN",
] as const;
export type ServerSpeechLocale = (typeof serverSpeechLocales)[number];
export function isServerSpeechLocale(
  locale: string,
): locale is ServerSpeechLocale {
  return serverSpeechLocales.some((supported) => supported === locale);
}
