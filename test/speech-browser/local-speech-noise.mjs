import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { chromium } from "playwright";
import ts from "typescript";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { cleanup, closeBrowser } from "./cleanup.mjs";
import { armShutdownWatchdog } from "./shutdown-watchdog.mjs";

// Uses the actual Silero model and browser WASM backend; ASR is a spy so a
// rejected recording cannot appear to pass merely because Whisper returned "".
const root = new URL("../../", import.meta.url);
const sources = [
  "local-speech-vad",
  "local-speech-vad-onnx",
  "local-speech-transcription",
];
const bodies = new Map();
for (const name of sources) {
  const source = await readFile(
    new URL(`src/core/services/${name}.ts`, root),
    "utf8",
  );
  bodies.set(
    `/${name}.js`,
    ts
      .transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
      })
      .outputText.replace(/(from "\.\/[^".]+)"/g, '$1.js"'),
  );
}
const model = await readFile(
  new URL("public/audio/vad/silero-v5.1.2.onnx", root),
);
assert.equal(
  createHash("sha256").update(model).digest("hex"),
  "2623a2953f6ff3d2c1e61740c6cdb7168133479b267dfef114a4a3cc5bdd788f",
);

function wavPcm(bytes) {
  assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
  let samples;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const tag = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (tag === "fmt ") {
      assert.equal(bytes.readUInt16LE(offset + 8), 1);
      assert.equal(bytes.readUInt16LE(offset + 10), 1);
      assert.equal(bytes.readUInt32LE(offset + 12), 16000);
      assert.equal(bytes.readUInt16LE(offset + 22), 16);
    }
    if (tag === "data") {
      samples = new Float32Array(size / 2 + 16000);
      for (let i = 0; i < size / 2; i++)
        samples[i + 8000] = bytes.readInt16LE(offset + 8 + i * 2) / 32768;
    }
    offset += size + 8 + (size & 1);
  }
  assert.ok(samples);
  return samples;
}

let seed = 123;
const random = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 2 ** 31 - 1;
};
function transients(duration, decay) {
  const pcm = new Float32Array(16000 * 4);
  for (let start = 8000; start < pcm.length - 16000; start += 6400)
    for (let i = 0; i < duration; i++)
      pcm[start + i] = random() * 0.8 * Math.exp(-i / decay);
  return pcm;
}
const cases = [
  { name: "silence", audio: new Float32Array(32000), speech: false },
  { name: "repeated-finger-snaps", audio: transients(400, 80), speech: false },
  {
    name: "repeated-claps-with-decay",
    audio: transients(2400, 500),
    speech: false,
  },
  {
    name: "steady-noise",
    audio: Float32Array.from({ length: 32000 }, () => random() * 0.05),
    speech: false,
  },
  {
    name: "tone",
    audio: Float32Array.from(
      { length: 32000 },
      (_, i) => Math.sin((i * 2 * Math.PI * 440) / 16000) * 0.15,
    ),
    speech: false,
  },
];
for (const word of ["obrigado", "tchau", "oi"])
  cases.push({
    name: `spoken-${word}`,
    audio: wavPcm(
      await readFile(new URL(`test/fixtures/speech/${word}.wav`, root)),
    ),
    speech: true,
  });

// Optional private excerpts are decoded mono Float32/16kHz. They stay local,
// are never logged as samples, uploaded, or copied into versioned fixtures.
for (const file of process.argv.slice(2)) {
  const bytes = await readFile(file);
  assert.equal(bytes.length % 4, 0);
  cases.push({
    name: `private-noise-${cases.length}`,
    audio: new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
    speech: false,
  });
}

const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname;
    let body = bodies.get(path);
    let type = "text/javascript";
    if (path === "/")
      body =
        '<!doctype html><script type="importmap">{"imports":{"onnxruntime-web":"/ort/ort.wasm.min.mjs"}}</script>';
    else if (path === "/audio/vad/silero-v5.1.2.onnx") {
      body = model;
      type = "application/octet-stream";
    } else if (/^\/ort\/[a-zA-Z0-9.-]+\.(mjs|wasm)$/.test(path)) {
      body = await readFile(
        new URL(
          `node_modules/onnxruntime-web/dist/${path.split("/").at(-1)}`,
          root,
        ),
      );
      if (path.endsWith(".wasm")) type = "application/wasm";
    }
    response.writeHead(body === undefined ? 404 : 200, {
      "content-type": path === "/" ? "text/html" : type,
    });
    response.end(body);
  } catch {
    response.writeHead(500);
    response.end();
  }
});
let ownedBrowser;
let browser;
try {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  ownedBrowser = await chromium.launchServer({
    headless: true,
    timeout: 20000,
  });
  browser = await chromium.connect(ownedBrowser.wsEndpoint());
  const page = await browser.newPage();
  await page.route("**/*", async (route) =>
    new URL(route.request().url()).hostname === "127.0.0.1"
      ? route.continue()
      : route.abort(),
  );
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(async () => {
    const ort = await import("onnxruntime-web");
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.wasmPaths = "/ort/";
    const { createLocalSpeechVad } = await import("/local-speech-vad-onnx.js");
    window.vad = await createLocalSpeechVad();
  });
  for (const test of cases) {
    const result = await page.evaluate(
      async ({ samples }) => {
        const { transcribeLocalSpeech } =
          await import("/local-speech-transcription.js");
        let calls = 0;
        const started = performance.now();
        const text = await transcribeLocalSpeech(
          Float32Array.from(samples),
          "pt-BR",
          window.vad,
          async () => {
            calls++;
            return { text: "Obrigado." };
          },
        );
        return {
          calls,
          text,
          milliseconds: Math.round(performance.now() - started),
        };
      },
      { samples: Array.from(test.audio) },
    );
    console.log(
      JSON.stringify({
        name: test.name,
        expectedSpeech: test.speech,
        ...result,
      }),
    );
    assert.equal(result.calls, test.speech ? 1 : 0, test.name);
    assert.equal(result.text, test.speech ? "Obrigado." : "", test.name);
  }
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
    console.error("LOCAL_SPEECH_NOISE_SHUTDOWN_TIMEOUT");
    process.exit(1);
  });
  assert.equal(connection.browserClosed, true, "Browser cleanup failed");
  assert.equal(closed.browserClosed, true, "Owned browser failed to close");
}
