import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { z } from "zod";
import { createClient, joinClients } from "./room-clients.mjs";
import { measure } from "./measure.mjs";

const schema = z
  .object({
    audioPcmPath: z.string().min(1),
    reference: z.string().min(1),
    consented: z.literal(true),
    referenceConfirmed: z.literal(true),
    earliestSpeechEndSample: z.number().int().positive(),
    speechEndReviewed: z.boolean(),
    modelRevision: z.string().regex(/^[a-f0-9]{40}$/),
    frontendRevision: z.string().min(7),
    backendRevision: z.string().min(7),
    environment: z.string().min(1),
  })
  .strict();
const configPath = resolve(process.argv[2] || "missing-private-fixture.json");
const config = schema.parse(JSON.parse(readFileSync(configPath, "utf8")));
const pcm = readFileSync(resolve(dirname(configPath), config.audioPcmPath));
if (
  !pcm.length ||
  pcm.length % 2 ||
  pcm.length > 384000 ||
  config.earliestSpeechEndSample > pcm.length / 2
)
  throw new Error("INVALID_PRIVATE_PCM_FIXTURE");
const frontendUrl = new URL(
  process.env.SPEECH_TEST_FRONTEND_URL || "http://localhost:3104",
).origin;
const apiUrl = new URL(
  process.env.SPEECH_TEST_API_URL || "http://localhost:3344",
).origin;
for (const url of [frontendUrl, apiUrl]) {
  if (
    !["localhost", "127.0.0.1"].includes(new URL(url).hostname) &&
    process.env.SPEECH_TEST_ALLOW_REMOTE !== "true"
  )
    throw new Error("REMOTE_TEST_REQUIRES_EXPLICIT_OPT_IN");
}
const directory = resolve(".speech-quality-private");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const output = resolve(directory, `browser-${randomUUID()}.json`);
const report = {
  scope: "browser-end-to-end",
  mocked: false,
  accepted: false,
  translationReviewed: false,
  createdAt: new Date().toISOString(),
  ...config,
  audioPcmPath: undefined,
  audioSha256: createHash("sha256").update(pcm).digest("hex"),
  sampleRate: 16000,
  audioSamples: pcm.length / 2,
  frontendUrl,
  apiUrl,
  runs: [],
};
let browser, room;
try {
  browser = await chromium.launch({
    ...(process.env.SPEECH_TEST_CHROME_PATH
      ? { executablePath: process.env.SPEECH_TEST_CHROME_PATH }
      : {}),
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  report.browser = await browser.version();
  const clients = await Promise.all([
    createClient(browser),
    createClient(browser),
  ]);
  await joinClients(clients, frontendUrl, (created) => {
    room = created;
  });
  for (let iteration = 0; iteration < 2; iteration++) {
    for (const sender of [0, 1]) {
      const run = await measure(
        clients,
        sender,
        pcm.toString("base64"),
        config.reference,
        config.earliestSpeechEndSample,
      );
      report.runs.push({ iteration, ...run });
      writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
      console.info(
        JSON.stringify({
          iteration,
          target: run.target,
          exactWords: run.exactWords,
          upperBoundMs: run.upperBoundMs,
          withinBudget: run.withinBudget,
          recovered: run.recovered,
        }),
      );
    }
  }
  report.browserErrors = clients.flatMap(({ errors }) => errors);
  if (
    report.browserErrors.length ||
    report.runs.some((run) => !run.exactWords || !run.withinBudget)
  )
    process.exitCode = 1;
} catch (error) {
  report.failure = error instanceof Error ? error.name : "TEST_FAILED";
  console.error("SPEECH_BROWSER_TEST_FAILED", report.failure);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (room?.roomId) {
    const response = await fetch(
      `${apiUrl}/room/${encodeURIComponent(room.roomId)}`,
      { method: "PATCH" },
    ).catch(() => null);
    report.cleanupSucceeded = response?.ok ?? false;
    if (!report.cleanupSucceeded) process.exitCode = 1;
  }
  writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.info("PRIVATE_EVIDENCE_SAVED", output);
  console.info(
    "ACCEPTANCE_PENDING: corpus, speech-end annotation, translation review and production matrix are separate gates.",
  );
}
