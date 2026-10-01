import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import ts from "typescript";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { cleanup, closeBrowser } from "./cleanup.mjs";
import { armShutdownWatchdog } from "./shutdown-watchdog.mjs";

// Browser integration for local capture and lifecycle, with a deterministic fake
// inference worker. It never loads Whisper, contacts an API, or records a person.
const modules = new Map([
  ["/local-speech-engine.js", "../../src/core/services/local-speech-engine.ts"],
  [
    "/local-speech-segmenter.js",
    "../../src/core/services/local-speech-segmenter.ts",
  ],
  [
    "/resample-local-speech.js",
    "../../src/core/services/resample-local-speech.ts",
  ],
  [
    "/server-speech/pcm-frame-buffer.js",
    "../../src/core/services/server-speech/pcm-frame-buffer.ts",
  ],
  [
    "/server-speech/activity-window.js",
    "../../src/core/services/server-speech/activity-window.ts",
  ],
]);
const bodies = new Map();
for (const [route, path] of modules) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const compiled = ts
    .transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
      },
    })
    .outputText.replaceAll(
      /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g,
      (_, before, specifier, after) => {
        const resolved = new URL(specifier, `http://localhost${route}`)
          .pathname;
        return `${before}${resolved}.js${after}`;
      },
    );
  bodies.set(route, compiled);
}
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
      ? "<!doctype html><title>Dicere local speech lifecycle</title>"
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
    executablePath: process.env.SPEECH_TEST_CHROME_PATH || undefined,
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
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    const callStream = await nativeGetUserMedia({ audio: true });
    const workerInstances = [];
    class FakeWorker {
      onmessage;
      onerror;
      messages = [];
      terminated = false;
      constructor() {
        workerInstances.push(this);
      }
      postMessage(message) {
        this.messages.push(message);
        if (message.type === "load")
          queueMicrotask(() => this.reply({ id: message.id, type: "ready" }));
      }
      reply(message) {
        if (!this.terminated) this.onmessage?.({ data: message });
      }
      terminate() {
        this.terminated = true;
      }
    }
    window.Worker = FakeWorker;
    const fixtures = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (constraints.video !== false || !constraints.audio)
        return nativeGetUserMedia(constraints);
      const context = new AudioContext({ sampleRate: 16000 });
      await context.resume();
      const destination = context.createMediaStreamDestination();
      const fixture = { context, destination, source: undefined };
      fixtures.push(fixture);
      return destination.stream;
    };
    window.testState = {
      callStream,
      fixtures,
      workerInstances,
      texts: [],
      errors: [],
      stages: [],
    };
    window.playSyntheticPhrase = (sequence = false) => {
      const fixture = fixtures.at(-1);
      const { context, destination } = fixture;
      const buffer = context.createBuffer(1, 16000 * (sequence ? 5 : 2), 16000);
      const samples = buffer.getChannelData(0);
      samples.fill(0.1, 1600, 12800); // 700 ms speech, then >650 ms silence.
      if (sequence) {
        samples.fill(0.1, 16000 * 1.7, 16000 * 2.4); // Second closed segment.
        samples.fill(0.1, 16000 * 3.4, 16000 * 4.3); // Partial at mute.
      }
      const source = context.createBufferSource();
      fixture.source = source;
      source.buffer = buffer;
      source.connect(destination);
      fixture.startedAt = context.currentTime;
      source.start();
    };
    window.createSpeechEngine = async () => {
      const { LocalSpeechEngine } = await import("/local-speech-engine.js");
      const state = window.testState;
      const engine = new LocalSpeechEngine({
        locale: "pt-BR",
        onStage: (stage) => state.stages.push(stage),
        onText: (text) => state.texts.push(text),
        onError: (error) => state.errors.push(error.errorName),
      });
      await engine.start();
      return engine;
    };
    window.disposeDicereFixture = async () => {
      window.activeEngine?.stop();
      navigator.mediaDevices.getUserMedia = nativeGetUserMedia;
      for (const fixture of fixtures) {
        try {
          fixture.source?.stop();
        } catch {
          /* Already ended. */
        }
        fixture.source?.disconnect();
        fixture.destination.stream.getTracks().forEach((track) => track.stop());
        fixture.destination.disconnect();
        if (fixture.context.state !== "closed") await fixture.context.close();
      }
      callStream.getTracks().forEach((track) => track.stop());
    };
    window.activeEngine = await window.createSpeechEngine();
    window.playSyntheticPhrase(true);
  });
  await page.waitForFunction(
    () =>
      window.testState.workerInstances[0]?.messages.some(
        (message) => message.type === "transcribe",
      ),
    null,
    { timeout: 10000 },
  );
  await page.waitForFunction(
    () => {
      const fixture = window.testState.fixtures[0];
      return fixture.context.currentTime - fixture.startedAt >= 3.8;
    },
    null,
    { timeout: 10000 },
  );
  const muted = await page.evaluate(() => {
    const state = window.testState;
    const worker = state.workerInstances[0];
    const transcribe = worker.messages.find(
      (message) => message.type === "transcribe",
    );
    window.finishPromise = window.activeEngine.finishClosedSegments();
    return {
      captureEnded: state.fixtures[0].destination.stream
        .getTracks()
        .every((track) => track.readyState === "ended"),
      callAlive: state.callStream
        .getTracks()
        .every((track) => track.readyState === "live"),
      workerPending: !worker.terminated,
      closedSamples: transcribe.audio.length,
      texts: [...state.texts],
    };
  });
  assert.equal(
    muted.captureEnded,
    true,
    "Mute must release the speech microphone synchronously",
  );
  assert.equal(muted.callAlive, true, "Mute must preserve the call microphone");
  assert.equal(muted.workerPending, true, "Closed inference must survive mute");
  assert.equal(
    muted.closedSamples > 16000 / 4,
    true,
    "Worker must receive a real closed segment",
  );
  assert.deepEqual(muted.texts, []);
  const drained = await page.evaluate(async () => {
    const state = window.testState;
    const worker = state.workerInstances[0];
    const request = worker.messages.find(
      (message) => message.type === "transcribe",
    );
    worker.reply({ id: request.id, type: "text", text: "Primeira fala." });
    await Promise.resolve();
    const second = worker.messages.filter(
      (message) => message.type === "transcribe",
    )[1];
    if (!second) throw new Error("SECOND_CLOSED_SEGMENT_NOT_DRAINED");
    worker.reply({ id: second.id, type: "text", text: "Segunda fala." });
    await window.finishPromise;
    worker.reply({ id: request.id, type: "text", text: "duplicada" });
    await Promise.resolve();
    return {
      texts: [...state.texts],
      transcriptions: worker.messages.filter(
        (message) => message.type === "transcribe",
      ).length,
      terminated: worker.terminated,
      errors: [...state.errors],
    };
  });
  assert.deepEqual(drained, {
    texts: ["Primeira fala.", "Segunda fala."],
    transcriptions: 2,
    terminated: true,
    errors: [],
  });

  await page.evaluate(async () => {
    window.activeEngine = await window.createSpeechEngine();
    window.playSyntheticPhrase();
  });
  await page.waitForFunction(
    () =>
      window.testState.workerInstances[1]?.messages.some(
        (message) => message.type === "transcribe",
      ),
    null,
    { timeout: 10000 },
  );
  const cancelled = await page.evaluate(async () => {
    const state = window.testState;
    const worker = state.workerInstances[1];
    const request = worker.messages.find(
      (message) => message.type === "transcribe",
    );
    const finishing = window.activeEngine.finishClosedSegments();
    window.activeEngine.stop();
    worker.reply({ id: request.id, type: "text", text: "não entregar" });
    await finishing;
    return {
      texts: [...state.texts],
      terminated: worker.terminated,
      captureEnded: state.fixtures[1].destination.stream
        .getTracks()
        .every((track) => track.readyState === "ended"),
      errors: [...state.errors],
    };
  });
  assert.deepEqual(cancelled, {
    texts: ["Primeira fala.", "Segunda fala."],
    terminated: true,
    captureEnded: true,
    errors: [],
  });
  assert.deepEqual(pageErrors, []);
  result = {
    suite: "local-engine-lifecycle",
    status: "passed",
    syntheticMicrophone: true,
    realAudioContext: true,
    realAudioWorklet: true,
    fakeInferenceWorker: true,
    closedSegmentsInOrderAfterMute: true,
    partialSegmentNotSent: true,
    cancellationDuringDrain: true,
    callStreamPreserved: true,
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
  armShutdownWatchdog(() => {
    console.error("LOCAL_ENGINE_LIFECYCLE_SHUTDOWN_TIMEOUT");
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
