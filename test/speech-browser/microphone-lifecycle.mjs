import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import ts from "typescript";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { cleanup, closeBrowser } from "./cleanup.mjs";
import { armShutdownWatchdog } from "./shutdown-watchdog.mjs";

// Browser/media integration only. No API, provider, real recording or user room.
const source = await readFile(
  new URL(
    "../../src/core/services/server-speech/microphone.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiledSource = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const worklet = await readFile(
  new URL("../../public/audio/dicere-pcm-processor.js", import.meta.url),
  "utf8",
);
const server = createServer((request, response) => {
  const body =
    request.url === "/microphone.js"
      ? compiledSource
      : request.url === "/audio/dicere-pcm-processor.js"
        ? worklet
        : request.url === "/"
          ? '<script type="module">import { SpeechMicrophone } from "/microphone.js"; window.SpeechMicrophone = SpeechMicrophone;</script>'
          : undefined;
  response.writeHead(body === undefined ? 404 : 200, {
    "content-type": request.url === "/" ? "text/html" : "text/javascript",
    "cache-control": "no-store",
  });
  response.end(body);
});
let ownedBrowser;
let browser;
let context;
let result;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  ownedBrowser = await chromium.launchServer({
    headless: true,
    executablePath: process.env.SPEECH_TEST_CHROME_PATH || undefined,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
    timeout: 20000,
  });
  browser = await chromium.connect(ownedBrowser.wsEndpoint());
  context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.name));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(
    () => typeof window.SpeechMicrophone === "function",
  );
  await page.evaluate(async () => {
    // A separate, real browser media stream represents the call's ownership.
    const getUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    window.callStream = await getUserMedia({ audio: true });
    window.speechStreams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await getUserMedia(constraints);
      window.speechStreams.push(stream);
      return stream;
    };
    window.framesReceived = 0;
    window.speechErrors = [];
    window.newCapture = () =>
      new window.SpeechMicrophone(
        (frame) => {
          if (!(frame instanceof Float32Array) || frame.length !== 2048)
            window.speechErrors.push("INVALID_PCM_FRAME");
          window.framesReceived++;
        },
        (code) => window.speechErrors.push(code),
      );
    window.capture = window.newCapture();
    window.disposeDicereFixture = () => {
      window.capture?.stop();
      for (const stream of [window.callStream, ...window.speechStreams])
        stream.getTracks().forEach((track) => track.stop());
    };
    await window.capture.start();
  });
  await page.waitForFunction(() => window.framesReceived >= 3, null, {
    timeout: 10000,
  });
  const stoppedAt = await page.evaluate(() => {
    window.capture.stop();
    return window.framesReceived;
  });
  await page.waitForTimeout(300);
  assert.deepEqual(
    await page.evaluate(() => ({
      frames: window.framesReceived,
      sttStopped: window.speechStreams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === "ended"),
      ),
      callAlive: window.callStream
        .getTracks()
        .every((track) => track.readyState === "live"),
      errors: window.speechErrors,
    })),
    { frames: stoppedAt, sttStopped: true, callAlive: true, errors: [] },
  );
  await page.evaluate(async () => {
    window.capture = window.newCapture();
    await window.capture.start();
  });
  await page.waitForFunction(
    (previous) => window.framesReceived >= previous + 3,
    stoppedAt,
    { timeout: 10000 },
  );
  assert.deepEqual(
    await page.evaluate(() => {
      window.capture.stop();
      const result = {
        captures: window.speechStreams.length,
        sttStopped: window.speechStreams.every((stream) =>
          stream.getTracks().every((track) => track.readyState === "ended"),
        ),
        callAlive: window.callStream
          .getTracks()
          .every((track) => track.readyState === "live"),
        errors: window.speechErrors,
      };
      window.callStream.getTracks().forEach((track) => track.stop());
      return result;
    }),
    { captures: 2, sttStopped: true, callAlive: true, errors: [] },
  );
  assert.deepEqual(pageErrors, []);
  result = {
    suite: "microphone-lifecycle",
    status: "passed",
    captures: 2,
    callStreamPreserved: true,
    syntheticMicrophone: true,
    browser: browser.version(),
  };
} finally {
  const connection = await cleanup({
    closeRoom: async () => true, // This isolated test never creates a room.
    closeBrowser: () => closeBrowser(browser),
    timeoutMs: 5000,
  });
  const closed = await stopOwnedBrowser(ownedBrowser, 5000);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  armShutdownWatchdog(() => {
    console.error("MICROPHONE_TEST_SHUTDOWN_TIMEOUT");
    process.exit(1);
  });
  assert.equal(
    connection.browserClosed,
    true,
    "Browser connection cleanup failed",
  );
  assert.equal(closed.browserClosed, true, "Owned browser failed to close");
  assert.equal(
    closed.browserForcedStop,
    false,
    "Owned browser needed forced termination",
  );
}
console.log(JSON.stringify(result));
