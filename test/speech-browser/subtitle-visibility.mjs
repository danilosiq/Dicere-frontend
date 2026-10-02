import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { chromium } from "playwright";
import ts from "typescript";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { cleanup, closeBrowser } from "./cleanup.mjs";
import { armShutdownWatchdog } from "./shutdown-watchdog.mjs";

// Production presentation helper + actual Chromium layout. React/socket
// composition is covered separately by Vitest; no speech model/API is used here.
const source = await readFile(
  new URL(
    "../../src/core/features/room/components/video/subtitle-presentation.ts",
    import.meta.url,
  ),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
const html = `<!doctype html><title>Dicere subtitle visibility</title>
<style>
body { margin: 0; min-height: 1800px; }
#history { margin-top: 300px; height: 90px; width: 280px; overflow-y: auto;
  border: 2px solid black; display: flex; flex-direction: column; gap: 8px; }
#history p { margin: 0; min-height: 100px; flex-shrink: 0; line-height: 20px; }
</style><div id="history"></div>`;
const server = createServer((request, response) => {
  const body =
    request.url === "/"
      ? html
      : request.url === "/presentation.js"
        ? compiled
        : undefined;
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
    timeout: 20000,
  });
  browser = await chromium.connect(ownedBrowser.wsEndpoint());
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const observations = await page.evaluate(async () => {
    const { selectCaptionPresentation, scrollToCaption } =
      await import("/presentation.js");
    const history = document.getElementById("history");
    const make = (sequence, receivedOrder) => ({
      sequence,
      receivedOrder,
      segmentId: `segment:${sequence}`,
      fromParticipantId: 'participant:"quoted]',
      translatedText: `Legenda ${sequence}`,
    });
    const render = (translations) => {
      const { visibleTranslations, latestTranslation } =
        selectCaptionPresentation(translations);
      history.replaceChildren(
        ...visibleTranslations.map((translation) => {
          const row = document.createElement("p");
          row.dataset.speechParticipantId = translation.fromParticipantId;
          row.dataset.speechSegmentId = translation.segmentId;
          row.dataset.speechSequence = String(translation.sequence);
          row.textContent = translation.translatedText;
          return row;
        }),
      );
      scrollToCaption(history, latestTranslation);
      const row = Array.from(history.children).find(
        (child) =>
          child.dataset.speechSegmentId === latestTranslation.segmentId,
      );
      const frame = history.getBoundingClientRect();
      const caption = row.getBoundingClientRect();
      return {
        sequences: visibleTranslations.map((item) => item.sequence),
        latest: latestTranslation.sequence,
        firstLineVisible:
          caption.top >= frame.top + history.clientTop - 1 &&
          caption.top + 20 <=
            frame.top + history.clientTop + history.clientHeight,
        atBottom:
          history.scrollTop === history.scrollHeight - history.clientHeight,
        pageScroll: window.scrollY,
      };
    };
    const initial = [make(2, 1), make(3, 2), make(4, 3)];
    const normal = render(initial);
    const late = render([make(1, 4), ...initial]);
    return { normal, late };
  });
  assert.deepEqual(observations.normal.sequences, [2, 3, 4]);
  assert.equal(observations.normal.atBottom, true);
  assert.deepEqual(observations.late.sequences, [1, 2, 3, 4]);
  assert.equal(observations.late.latest, 1);
  assert.equal(observations.late.firstLineVisible, true);
  assert.equal(observations.late.atBottom, false);
  assert.equal(observations.normal.pageScroll, 0);
  assert.equal(observations.late.pageScroll, 0);
  assert.deepEqual(errors, []);
  result = {
    suite: "subtitle-visibility",
    status: "passed",
    browser: browser.version(),
    productionHelper: true,
    realLayout: true,
    lateCaptionFirstLineVisible: true,
    chronologicalReading: true,
    documentScrollPreserved: true,
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
    console.error("SUBTITLE_VISIBILITY_SHUTDOWN_TIMEOUT");
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
    "Browser required forced termination",
  );
}
console.log(JSON.stringify(result));
