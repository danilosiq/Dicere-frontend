import { chromium } from "playwright";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { resolve, dirname } from "node:path";
import { z } from "zod";
import { createClient, joinClients } from "./room-clients.mjs";
import { measure } from "./measure.mjs";
import { runBatch, summarizeOverlap } from "./run-batch.mjs";
import { cleanup } from "./cleanup.mjs";

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
const frontendProxy = process.env.SPEECH_TEST_FRONTEND_PROXY
  ? new URL(process.env.SPEECH_TEST_FRONTEND_PROXY).origin
  : undefined;
if (
  frontendProxy &&
  !["localhost", "127.0.0.1"].includes(new URL(frontendProxy).hostname)
)
  throw new Error("FRONTEND_PROXY_MUST_BE_LOCAL");
const existingRoom = process.env.SPEECH_TEST_EXISTING_ROOM_FILE
  ? z
      .object({
        ownedTestRoom: z.literal(true),
        roomId: z.string().uuid(),
        code: z.string().min(1),
        title: z.string(),
        adminParticipantId: z.string().uuid(),
        password: z.string().min(1),
      })
      .strict()
      .parse(
        JSON.parse(
          readFileSync(process.env.SPEECH_TEST_EXISTING_ROOM_FILE, "utf8"),
        ),
      )
  : undefined;
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
const simultaneous = process.env.SPEECH_TEST_SIMULTANEOUS === "true";
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
  frontendDelivery: frontendProxy
    ? "local-candidate-proxied-under-real-origin"
    : "normal",
  concurrentSpeakers: simultaneous ? 2 : 1,
  batches: [],
  runs: [],
};
let browser, room;
function saveReport() {
  try {
    writeFileSync(output, JSON.stringify(report, null, 2), { mode: 0o600 });
    return true;
  } catch {
    console.error("PRIVATE_EVIDENCE_WRITE_FAILED");
    process.exitCode = 1;
    return false;
  }
}
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
    createClient(browser, frontendUrl, frontendProxy),
    createClient(browser, frontendUrl, frontendProxy),
  ]);
  await joinClients(
    clients,
    frontendUrl,
    (created) => {
      room = created;
    },
    existingRoom,
  );
  for (let iteration = 0; iteration < 2; iteration++) {
    const results = await runBatch(simultaneous, (sender) =>
      measure(
        clients,
        sender,
        pcm.toString("base64"),
        config.reference,
        config.earliestSpeechEndSample,
      ),
    );
    const successful = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const overlap = summarizeOverlap(successful);
    report.batches.push({ iteration, ...overlap });
    if (simultaneous && (!overlap || overlap.minimumOverlapMs <= 0))
      process.exitCode = 1;
    for (const result of results) {
      if (result.status === "rejected") {
        report.runs.push({
          iteration,
          failure:
            result.reason instanceof Error ? result.reason.name : "TEST_FAILED",
          exactWords: false,
          withinBudget: false,
        });
        process.exitCode = 1;
        continue;
      }
      const run = result.value;
      report.runs.push({ iteration, ...run });
      if (!saveReport()) throw new Error("PRIVATE_EVIDENCE_WRITE_FAILED");
      console.info(
        JSON.stringify({
          iteration,
          target: run.target,
          exactWords: run.exactWords,
          upperBoundMs: run.upperBoundMs,
          withinBudget: run.withinBudget,
          recovered: run.recovered,
          minimumOverlapMs: overlap?.minimumOverlapMs,
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
  saveReport();
  const result = await cleanup({
    closeRoom: async () => {
      if (!room?.roomId) return true;
      const response = await fetch(
        `${apiUrl}/room/${encodeURIComponent(room.roomId)}`,
        { method: "PATCH", signal: AbortSignal.timeout(5000) },
      );
      return response.ok;
    },
    closeBrowser: () => browser?.close(),
  });
  Object.assign(report, result);
  if (!result.cleanupSucceeded || !result.browserClosed) process.exitCode = 1;
  if (saveReport()) console.info("PRIVATE_EVIDENCE_SAVED", output);
  console.info(
    "ACCEPTANCE_PENDING: corpus, speech-end annotation, translation review and production matrix are separate gates.",
  );
  // Do not keep a remote pilot enabled because a Chromium child is stuck.
  if (!result.browserClosed) process.exit(1);
}
