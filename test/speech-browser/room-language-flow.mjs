import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { installMicrophoneFixture } from "./microphone-fixture.mjs";
import { closeBrowser, cleanup } from "./cleanup.mjs";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { armShutdownWatchdog } from "./shutdown-watchdog.mjs";

// Real public room/preferences APIs. Only incoming subtitle text is simulated;
// this suite never claims speech recognition or provider translation accuracy.
const frontend = process.env.UI_TEST_URL ?? "https://dicere.cloud";
const api = process.env.UI_TEST_API ?? "https://api.dicere.cloud";
const names = {
  "PT-BR": "Português",
  EN: "Inglês",
  ES: "Espanhol",
  "ZH-HANS": "Chinês",
};
const targetLabel = "Idioma que deseja receber as traduções";
const spokenLabel = "Idioma que você irá falar na chamada";
const password = randomUUID();
let room;
let browser;
let owned;
const errors = [];
async function select(page, label, language) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const options = page.getByRole("option");
  assert.equal(await options.count(), 4);
  await options
    .filter({ hasText: new RegExp(`^\\s*${names[language]}\\s*$`) })
    .click();
}
async function stored(page) {
  return page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("dicere-room-session")),
  );
}
async function waitPreference(page, key, value) {
  await page.waitForFunction(
    ({ key, value }) =>
      JSON.parse(sessionStorage.getItem("dicere-room-session"))?.[key] ===
      value,
    { key, value },
  );
}
async function inject(page, sequence) {
  await page.evaluate(
    ({ roomId, sequence }) => {
      const payload = {
        roomId,
        fromParticipantId: "ui-fixture-speaker",
        fromParticipantName: "UI Fixture",
        originalText: "PRIVATE_ORIGINAL_NOT_DISPLAYED",
        translatedText: `Legenda de interface ${sequence}: texto longo para conferir o histórico completo e a rolagem durante uma conversa.`,
        targetLanguage: "PT-BR",
        segmentId: `ui:${sequence}`,
        sequence,
        revision: 0,
        status: "final",
      };
      window.dicereUISocket.dispatchEvent(
        new MessageEvent("message", {
          data: "42" + JSON.stringify(["voice_translation_received", payload]),
        }),
      );
    },
    { roomId: room.roomId, sequence },
  );
}
try {
  owned = await chromium.launchServer({
    headless: true,
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  });
  browser = await chromium.connect(owned.wsEndpoint());
  const pages = [];
  for (let index = 0; index < 2; index++) {
    const context = await browser.newContext({
      locale: "pt-BR",
      permissions: ["camera", "microphone"],
      viewport: { width: 1440, height: 1000 },
    });
    await context.addInitScript(installMicrophoneFixture);
    await context.addInitScript(() => {
      const Native = window.WebSocket;
      window.WebSocket = class extends Native {
        constructor(...args) {
          super(...args);
          if (String(args[0]).includes("socket.io"))
            window.dicereUISocket = this;
        }
      };
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    page.on("pageerror", (error) => errors.push(error.name));
    pages.push(page);
  }
  const [first, second] = pages;
  await first.goto(frontend);
  await first
    .getByRole("button", { name: "Criar uma sala", exact: true })
    .click();
  await first.getByLabel("Título da sala").fill("QA idiomas e histórico");
  await first.getByLabel("Seu nome").fill("UI Admin");
  await first.getByLabel(/^Senha/).fill(password);
  await select(first, targetLabel, "PT-BR");
  await select(first, spokenLabel, "ES");
  const created = first.waitForResponse(
    (response) =>
      response.url().endsWith("/room") &&
      response.request().method() === "POST",
  );
  await first.getByRole("button", { name: "Confirmar", exact: true }).click();
  room = (await (await created).json()).data;
  await first.waitForURL("**/room/*");
  await second.goto(frontend);
  await second
    .getByRole("button", { name: "Entrar na sala", exact: true })
    .click();
  await second.getByLabel("Código da sala").fill(room.code);
  await second.getByLabel("Seu nome").fill("UI Guest");
  await second.getByLabel(/^Senha/).fill(password);
  await select(second, targetLabel, "EN");
  await select(second, spokenLabel, "ZH-HANS");
  await second.getByRole("button", { name: "Confirmar", exact: true }).click();
  await second.waitForURL("**/room/*");
  for (const [page, spoken, target] of [
    [first, "ES", "PT-BR"],
    [second, "ZH-HANS", "EN"],
  ]) {
    assert.equal((await stored(page)).spokenLanguage, spoken);
    assert.equal((await stored(page)).targetLanguage, target);
    await page
      .getByRole("button", {
        name: `Selecionar idioma: ${names[spoken]}`,
        exact: true,
      })
      .waitFor();
    // Mute before consent: no audio is transcribed in this UI-only test.
    await page
      .getByRole("button", { name: "Desativar microfone", exact: true })
      .click();
    const consent = page.getByRole("button", {
      name: "Ativar transcrição nesta sala",
      exact: true,
    });
    if (await consent.count()) await consent.click();
  }
  for (const language of Object.keys(names)) {
    await select(first, "Seu idioma falado", language);
    await waitPreference(first, "spokenLanguage", language);
    await first
      .getByRole("button", {
        name: `Selecionar idioma: ${names[language]}`,
        exact: true,
      })
      .waitFor();
    await select(first, "Idioma que está traduzindo", language);
    await waitPreference(first, "targetLanguage", language);
    const response = await fetch(`${api}/room/${room.roomId}`, {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.ok, true);
    const body = await response.json();
    const participant = body.participants.find(
      (item) => item.id === room.adminParticipantId,
    );
    assert.equal(participant.targetLanguage, language);
  }
  for (let sequence = 1; sequence <= 12; sequence++)
    await inject(first, sequence);
  const feed = first.getByLabel("Legenda traduzida", { exact: true });
  await feed.locator("p").nth(11).waitFor();
  assert.equal(await feed.locator("p").count(), 12);
  assert.equal(
    await first
      .getByText("PRIVATE_ORIGINAL_NOT_DISPLAYED", { exact: true })
      .count(),
    0,
  );
  let nextSequence = 13;
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await first.setViewportSize(viewport);
    for (const dark of [false, true]) {
      await first.evaluate(
        (dark) => document.documentElement.classList.toggle("dark", dark),
        dark,
      );
      const geometry = await feed.evaluate((element) => {
        const panel = element.parentElement;
        const wrapper = panel.parentElement;
        element.scrollTop = 0;
        element.dispatchEvent(new Event("scroll", { bubbles: true }));
        return {
          height: element.clientHeight,
          panelHeight: panel.getBoundingClientRect().height,
          wrapperHeight: wrapper.getBoundingClientRect().height,
          scrollable: element.scrollHeight > element.clientHeight,
          bar: getComputedStyle(element).scrollbarWidth,
          thumb: getComputedStyle(element, "::-webkit-scrollbar").display,
        };
      });
      assert.ok(
        geometry.height > 40,
        "subtitle feed must have usable vertical space",
      );
      assert.ok(Math.abs(geometry.panelHeight - geometry.wrapperHeight) < 5);
      assert.equal(geometry.scrollable, true);
      assert.equal(geometry.bar, "none");
      assert.equal(geometry.thumb, "none");
      await inject(first, nextSequence++);
      await feed
        .locator("p")
        .nth(nextSequence - 2)
        .waitFor();
      assert.equal(
        await feed.evaluate((element) => element.scrollTop),
        0,
        "new caption must preserve older reading",
      );
      await feed.focus();
      await first.keyboard.press("End");
      await first.waitForFunction(
        () =>
          document.querySelector('[aria-label="Legenda traduzida"]').scrollTop >
          0,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      suite: "room-language-flow",
      status: "passed",
      realRoomAPI: true,
      realPreferencePersistence: true,
      forms: 2,
      languages: Object.keys(names),
      spokenChatShared: true,
      subtitleDelivery: "simulated UI only",
      historyEntries: nextSequence - 1,
      viewports: ["desktop", "mobile"],
      themes: ["light", "dark"],
      keyboardScroll: true,
      hiddenScrollbar: true,
      readingPreserved: true,
      translationAccuracyTested: false,
    }),
  );
} finally {
  const result = await cleanup({
    closeRoom: async () =>
      !room?.roomId ||
      (
        await fetch(`${api}/room/${room.roomId}`, {
          method: "PATCH",
          signal: AbortSignal.timeout(5000),
        })
      ).ok,
    closeBrowser: () => closeBrowser(browser),
  });
  const stopped = await stopOwnedBrowser(owned);
  armShutdownWatchdog(() => process.exit(1));
  assert.equal(result.cleanupSucceeded, true);
  assert.equal(result.browserClosed, true);
  assert.equal(stopped.browserClosed, true);
  assert.equal(stopped.browserForcedStop, false);
}
