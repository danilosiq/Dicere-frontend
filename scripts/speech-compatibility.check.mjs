import assert from "node:assert/strict";
import { test } from "node:test";
import { verifySpeechBackend } from "./speech-compatibility.mjs";

const contract = {
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
const document = {
  "x-speech-release": contract,
  "x-websocket-events": Object.fromEntries(
    ["ready", "start", "chunk", "finish", "cancel"].map((event) => [
      `speech_${event}`,
      {},
    ]),
  ),
};
const respond =
  (body = document, status = 200) =>
  async () =>
    new Response(JSON.stringify(body), { status });

test("accepts the compatible pilot contract without claiming quality approval", async () => {
  let observed;
  const result = await verifySpeechBackend(
    "https://api.example/",
    async (url, options) => {
      observed = { url: String(url), options };
      return respond()();
    },
  );
  assert.equal(result, "SPEECH_BACKEND_COMPATIBLE_PILOT_ONLY");
  assert.equal(observed.url, "https://api.example/openapi.json");
  assert.equal(observed.options.redirect, "error");
  assert.ok(observed.options.signal instanceof AbortSignal);
});

for (const [name, body] of [
  ["old backend", {}],
  [
    "old concurrency",
    {
      ...document,
      "x-speech-release": { ...contract, captureWhileProcessing: false },
    },
  ],
  [
    "wrong protocol",
    { ...document, "x-speech-release": { ...contract, protocolVersion: 2 } },
  ],
  [
    "unreviewed global release",
    {
      ...document,
      "x-speech-release": { ...contract, globalActivationAllowed: true },
    },
  ],
  ["missing events", { ...document, "x-websocket-events": {} }],
]) {
  test(`blocks ${name}`, async () => {
    await assert.rejects(
      verifySpeechBackend("https://api.example", respond(body)),
      /^Error: STT_BACKEND_INCOMPATIBLE$/,
    );
  });
}

test("network, malformed responses and server errors expose only technical codes", async () => {
  for (const request of [
    respond({}, 503),
    async () => {
      throw new Error("private network information");
    },
    async () => new Response("private non-json response"),
    async () => new Response("x".repeat(1048577)),
  ]) {
    await assert.rejects(
      verifySpeechBackend("https://api.example", request),
      (error) =>
        /^STT_(BACKEND_UNAVAILABLE|BACKEND_INCOMPATIBLE|RESPONSE_TOO_LARGE)$/.test(
          error.message,
        ),
    );
  }
});

test("rejects unsafe URLs before any network request", async () => {
  for (const url of [
    "http://api.example",
    "https://user:secret@api.example",
    "not-a-url",
  ]) {
    await assert.rejects(
      verifySpeechBackend(url, () => assert.fail("must not fetch")),
      /^Error: STT_INVALID_API_URL$/,
    );
  }
});
