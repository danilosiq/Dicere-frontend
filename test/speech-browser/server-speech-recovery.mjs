import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import ts from "typescript";
import { closeBrowser, cleanup } from "./cleanup.mjs";
import { stopOwnedBrowser } from "./browser-process.mjs";

// Real browser microphone/worklet; deterministic transport, no room/API/provider.
const bodies = new Map();
for (const name of [
  "recovery",
  "recovery-policy",
  "engine",
  "microphone",
  "client",
  "segmenter",
  "capture-policy",
  "languages",
  "activity-window",
  "pcm-frame-buffer",
  "pcm-preroll",
]) {
  const route = `/server-speech/${name}.js`;
  const source = await readFile(
    new URL(
      `../../src/core/services/server-speech/${name}.ts`,
      import.meta.url,
    ),
    "utf8",
  );
  bodies.set(
    route,
    ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ES2022,
        },
      })
      .outputText.replaceAll(
        /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
        (_, before, specifier, after) =>
          `${before}${new URL(specifier, `http://localhost${route}`).pathname}.js${after}`,
      ),
  );
}
bodies.set(
  "/socket-service.js",
  "export const getSocket = () => window.testSocket;",
);
bodies.set(
  "/speech-translation-service.js",
  "export const recordSpeechTranslationMetric = () => {};",
);
bodies.set(
  "/server-speech/transport.js",
  `export async function requestSpeech(event, payload) {
  if (!window.testSocket.connected) throw new Error("STT_DISCONNECTED");
  if (event === "speech_start") return {result:"ok", sessionId:crypto.randomUUID()};
  if (event === "speech_chunk") window.chunks++;
  if (event === "speech_finish") window.finishes.push(payload.sessionId);
  return {result:"ok", version:1};
}`,
);
bodies.set(
  "/audio/dicere-pcm-processor.js",
  await readFile(
    new URL("../../public/audio/dicere-pcm-processor.js", import.meta.url),
    "utf8",
  ),
);
const server = createServer((request, response) => {
  const body =
    request.url === "/"
      ? "<!doctype html><title>Dicere recovery fixture</title>"
      : bodies.get(request.url);
  response.writeHead(body === undefined ? 404 : 200, {
    "content-type": request.url === "/" ? "text/html" : "text/javascript",
    "cache-control": "no-store",
  });
  response.end(body);
});
let ownedBrowser;
let browser;
let result;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  ownedBrowser = await chromium.launchServer({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      "--autoplay-policy=no-user-gesture-required",
    ],
    timeout: 20000,
  });
  browser = await chromium.connect(ownedBrowser.wsEndpoint());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const handlers = new Map();
    window.testSocket = {
      connected: true,
      on(event, callback) {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event).add(callback);
      },
      off(event, callback) {
        handlers.get(event)?.delete(callback);
      },
      emit(event) {
        for (const callback of handlers.get(event) ?? []) callback();
      },
    };
    const native = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    window.callStream = await native({ audio: true });
    window.streams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await native(constraints);
      window.streams.push(stream);
      return stream;
    };
    window.chunks = 0;
    window.finishes = [];
    window.issues = [];
    window.stage = "idle";
    const { RecoveringSpeechEngine } =
      await import("/server-speech/recovery.js");
    window.engine = new RecoveringSpeechEngine({
      roomId: "fixture",
      locale: "pt-BR",
      onStage: (stage) => {
        window.stage = stage;
      },
      onError: (code, recovering) => window.issues.push({ code, recovering }),
    });
    window.disposeDicereFixture = () => {
      window.engine.stop();
      window.callStream.getTracks().forEach((track) => track.stop());
    };
    window.engine.start();
  });
  await page.waitForFunction(() => window.chunks >= 2, null, {
    timeout: 10000,
  });
  const before = await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    return window.chunks;
  });
  await page.waitForFunction((before) => window.chunks > before + 2, before, {
    timeout: 10000,
  });
  await page.evaluate(() =>
    window.streams[0].getAudioTracks()[0].dispatchEvent(new Event("ended")),
  );
  await page.waitForFunction(
    () => window.streams.length === 2 && window.stage === "listening",
  );
  await page.evaluate(() => {
    window.testSocket.connected = false;
  });
  await context.setOffline(true);
  await page.waitForTimeout(1200);
  assert.equal(await page.evaluate(() => window.streams.length), 2);
  await context.setOffline(false);
  await page.evaluate(() => {
    window.testSocket.connected = true;
    window.testSocket.emit("room_joined");
  });
  await page.waitForFunction(
    () => window.streams.length === 3 && window.stage === "listening",
  );
  const state = await page.evaluate(() => {
    window.engine.stop();
    return {
      captures: window.streams.length,
      allCapturesStopped: window.streams.every((stream) =>
        stream.getTracks().every((track) => track.readyState === "ended"),
      ),
      callStreamPreserved: window.callStream
        .getTracks()
        .every((track) => track.readyState === "live"),
      backgroundError: window.issues.some(
        ({ code }) => code === "STT_BACKGROUND_PAUSED",
      ),
      noAudioReplay: window.finishes.length === new Set(window.finishes).size,
    };
  });
  assert.deepEqual(state, {
    captures: 3,
    allCapturesStopped: true,
    callStreamPreserved: true,
    backgroundError: false,
    noAudioReplay: true,
  });
  await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(() => window.streams.length), 3);
  assert.deepEqual(errors, []);
  result = {
    suite: "server-speech-recovery",
    status: "passed",
    ...state,
    syntheticMicrophone: true,
    syntheticVisibility: true,
    simulatedTransport: true,
    browser: browser.version(),
  };
} finally {
  const connection = await cleanup({
    closeRoom: async () => true,
    closeBrowser: () => closeBrowser(browser),
    timeoutMs: 5000,
  });
  const closed = await stopOwnedBrowser(ownedBrowser, 5000);
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  assert.equal(connection.browserClosed, true);
  assert.equal(closed.browserClosed, true);
  assert.equal(closed.browserForcedStop, false);
}
console.log(JSON.stringify(result));
