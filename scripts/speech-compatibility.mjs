import { pathToFileURL } from "node:url";

const expected = {
  version: 1,
  phase: "pilot-only",
  globalActivationAllowed: false,
  protocolVersion: 1,
  captureWhileProcessing: true,
  sampleRate: 16000,
  format: "pcm_s16le",
  channels: 1,
  locale: "pt-BR",
};
const events = ["ready", "start", "chunk", "finish", "cancel"];

export async function verifySpeechBackend(baseUrl, request = fetch) {
  let url;
  try {
    url = new URL(baseUrl);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    url = new URL("/openapi.json", url);
  } catch {
    throw new Error("STT_INVALID_API_URL");
  }
  let response;
  try {
    response = await request(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok || !response.body) throw new Error();
  } catch {
    throw new Error("STT_BACKEND_UNAVAILABLE");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1048576) throw new Error("STT_RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
    const document = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const contract = document?.["x-speech-release"];
    if (
      !Object.entries(expected).every(
        ([key, value]) => contract?.[key] === value,
      ) ||
      !events.every(
        (event) =>
          typeof document?.["x-websocket-events"]?.[`speech_${event}`] ===
            "object" &&
          document["x-websocket-events"][`speech_${event}`] !== null,
      )
    )
      throw new Error("STT_BACKEND_INCOMPATIBLE");
    return "SPEECH_BACKEND_COMPATIBLE_PILOT_ONLY";
  } catch (error) {
    throw new Error(
      error?.message === "STT_RESPONSE_TOO_LARGE"
        ? "STT_RESPONSE_TOO_LARGE"
        : "STT_BACKEND_INCOMPATIBLE",
    );
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  verifySpeechBackend(process.argv[2]).then(
    (code) => console.log(code),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
