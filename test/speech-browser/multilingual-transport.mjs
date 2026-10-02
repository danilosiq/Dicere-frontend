// Real API + Socket.IO + STT + DeepL. Only creates/closes owned QA rooms.
// References/transcripts remain in a private report, never stdout or model input.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { probeRoom, speechAck } from "./probe-room.mjs";

const apiUrl = new URL(
  process.env.SPEECH_TEST_API_URL || "http://localhost:3333",
).origin;
if (
  !["localhost", "127.0.0.1"].includes(new URL(apiUrl).hostname) &&
  process.env.SPEECH_TEST_ALLOW_REMOTE !== "true"
)
  throw new Error("REMOTE_TEST_REQUIRES_EXPLICIT_OPT_IN");
const fixturePath = resolve(process.argv[2]);
const fixtures = JSON.parse(readFileSync(fixturePath, "utf8"));
const output = resolve(process.argv[3]);
const locales = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  zh: "zh-CN",
};
const sources = { pt: "PT", en: "EN", es: "ES", zh: "ZH" };
const results = [];
for (const fixture of fixtures) {
  const locale = locales[fixture.language];
  if (!locale) throw new Error("PROBE_INVALID_SOURCE");
  const audio = readFileSync(resolve(dirname(fixturePath), fixture.file));
  if (
    !audio.length ||
    audio.length % 2 ||
    audio.length > 384000 ||
    !audio.some((byte) => byte !== 0)
  )
    throw new Error("PROBE_INVALID_PCM");
  const targetLanguage = fixture.language === "pt" ? "ES" : "PT-BR";
  const room = await probeRoom(apiUrl, targetLanguage);
  const translations = [];
  room.receiver.on("voice_translation_received", (value) =>
    translations.push(value),
  );
  const started = performance.now();
  let finished;
  try {
    const payload = {
      version: 1,
      roomId: room.roomId,
      locale,
      format: "pcm_s16le",
      sampleRate: 16000,
      channels: 1,
    };
    const ready = await speechAck(room.sender, "speech_ready", payload);
    if (ready.locale !== locale) throw new Error("PROBE_LOCALE_MISMATCH");
    const session = await speechAck(room.sender, "speech_start", payload);
    let sequence = 0;
    for (let offset = 0; offset < audio.length; offset += 16000) {
      await speechAck(room.sender, "speech_chunk", {
        sessionId: session.sessionId,
        sequence: sequence++,
        audio: audio.subarray(offset, offset + 16000),
      });
    }
    finished = performance.now();
    await speechAck(room.sender, "speech_finish", {
      sessionId: session.sessionId,
      lastSequence: sequence - 1,
    });
    await pause(200);
    if (
      !translations.length ||
      translations.some(
        (value) =>
          value.sourceLanguage !== sources[fixture.language] ||
          value.targetLanguage !== targetLanguage ||
          !value.originalText ||
          !value.translatedText,
      )
    )
      throw new Error("PROBE_TRANSLATION_MISSING_OR_WRONG_SOURCE");
    results.push({
      ...fixture,
      locale,
      targetLanguage,
      ok: true,
      finishToReceivedMs: Math.round(performance.now() - finished - 200),
      translations,
    });
  } catch (error) {
    results.push({
      ...fixture,
      locale,
      targetLanguage,
      ok: false,
      code: /^[A-Z_]+$/.test(error.message) ? error.message : "PROBE_FAILED",
      elapsedMs: Math.round(performance.now() - started),
      translations,
    });
  } finally {
    await room.close();
    audio.fill(0);
    writeFileSync(
      output,
      JSON.stringify(
        { scope: "real-production-transport-not-dom", results },
        null,
        2,
      ),
      { mode: 0o600 },
    );
  }
  console.info(
    JSON.stringify({
      locale,
      ok: results.at(-1).ok,
      code: results.at(-1).code,
      finishToReceivedMs: results.at(-1).finishToReceivedMs,
    }),
  );
  await pause(1000);
}
if (results.some((result) => !result.ok)) process.exitCode = 1;
