import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { io } from "socket.io-client";
import { closeBrowser, cleanup } from "./cleanup.mjs";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { armShutdownWatchdog } from "./shutdown-watchdog.mjs";

// Real room API, presence and browser navigation. No speech/translation calls.
const frontend = process.env.UI_TEST_URL ?? "https://dicere.cloud";
const api = process.env.UI_TEST_API ?? "https://api.dicere.cloud";
const password = randomUUID();
const mediaAllowed = process.env.UI_TEST_MEDIA === "allowed";
const sockets = [];
let room;
let browser;
let owned;
const checks = [];
async function count(expected) {
  const deadline = Date.now() + 5000;
  let actual;
  do {
    const response = await fetch(`${api}/room/${room.roomId}`, {
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.ok, true);
    actual = (await response.json()).participants.length;
    if (actual === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  assert.equal(actual, expected, "public API must not count an exited browser");
}
async function connect() {
  const socket = io(api, {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000,
  });
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  return socket;
}
async function enter(socket, nickname, participantId) {
  return new Promise((resolve, reject) => {
    const done = (fn, data) => {
      clearTimeout(timer);
      socket.off("room_joined", joined);
      socket.off("error", failed);
      fn(data);
    };
    const joined = (data) => done(resolve, data);
    const failed = (error) => {
      if (error.event === "join_room") done(reject, error);
    };
    const timer = setTimeout(
      () => done(reject, new Error("JOIN_TIMEOUT")),
      5000,
    );
    socket.on("room_joined", joined);
    socket.on("error", failed);
    socket.emit("join_room", {
      roomCode: room.code,
      password,
      nickname,
      participantId,
    });
  });
}
async function joinUI(page) {
  if (!page.url().includes("roomCode=")) {
    await page
      .getByRole("button", { name: "Entrar na sala", exact: true })
      .click();
  }
  if (await page.getByLabel("Seu nome").count()) {
    await page.getByLabel("Código da sala").fill(room.code);
    await page.getByLabel("Seu nome").fill("Reconnect Guest");
    for (const label of [
      "Idioma que deseja receber as traduções",
      "Idioma que você irá falar na chamada",
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await page
        .getByRole("option")
        .filter({ hasText: /^\s*Português\s*$/ })
        .click();
    }
  }
  await page.getByLabel(/^Senha/).fill(password);
  if (mediaAllowed)
    await page.evaluate(() => {
      window.dicereCallJoined = false;
    });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  try {
    await page.waitForURL("**/room/*");
  } catch (error) {
    console.error(
      "ROOM_JOIN_UI_FAILED",
      new URL(page.url()).pathname,
      await page.getByRole("alert").allTextContents(),
      await page.locator("input").evaluateAll((inputs) =>
        inputs.map((input) => ({
          name: input.name,
          valid: input.checkValidity(),
          validationMessage: input.validationMessage,
        })),
      ),
    );
    throw error;
  }
  await page
    .getByRole("button", { name: "Sair da chamada", exact: true })
    .waitFor();
  if (mediaAllowed)
    await page.waitForFunction(() => window.dicereCallJoined === true);
}
const stored = (page) =>
  page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("dicere-room-session")),
  );
try {
  const response = await fetch(`${api}/room`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "QA reconnection",
      participantName: "Reconnect Admin",
      password,
      targetLanguage: "PT-BR",
    }),
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.ok, true);
  room = (await response.json()).data;
  const admin = await connect();
  await enter(admin, "Reconnect Admin", room.adminParticipantId);
  owned = await chromium.launchServer({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  browser = await chromium.connect(owned.wsEndpoint());
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  await context.addInitScript((allowed) => {
    // Reproduce room admission followed by media failure (call never started).
    if (!allowed)
      navigator.mediaDevices.getUserMedia = async () => {
        throw new DOMException("QA media denied", "NotAllowedError");
      };
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(...args) {
        super(...args);
        if (String(args[0]).includes("socket.io"))
          window.dicereRoomSocket = this;
        this.addEventListener("message", ({ data }) => {
          if (typeof data === "string" && data.startsWith("42")) {
            const [event] = JSON.parse(data.slice(2));
            if (event === "call-joined") window.dicereCallJoined = true;
          }
        });
      }
    };
  }, mediaAllowed);
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  if (process.env.UI_TEST_TRACE) {
    page.on("pageerror", (error) =>
      console.log("ROOM_PAGE_ERROR", error.message),
    );
    page.on("websocket", (socket) => {
      for (const direction of ["framesent", "framereceived"])
        socket.on(direction, ({ payload }) => {
          if (typeof payload !== "string" || !payload.startsWith("42")) return;
          const [event, data] = JSON.parse(payload.slice(2));
          console.log("ROOM_EVENT", direction, event, data?.code ?? "");
        });
    });
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame())
        console.log("ROOM_NAV", new URL(frame.url()).pathname);
    });
  }
  await page.goto(frontend);
  await joinUI(page);
  await count(2);
  const third = await connect();
  await assert.rejects(
    enter(third, "Reconnect Third"),
    (error) => error.code === "ROOM_FULL",
  );
  const identity = (await stored(page)).participantId;
  await assert.rejects(
    enter(third, "Reconnect Guest", identity),
    (error) => error.code === "PARTICIPANT_ALREADY_CONNECTED",
  );
  checks.push("capacity-and-active-identity-protected");
  await page
    .getByRole("button", { name: "Sair da chamada", exact: true })
    .click();
  await page.waitForURL((url) => url.pathname === "/" && url.search === "");
  assert.equal(await stored(page), null);
  await count(1);
  checks.push("leave-without-started-call");
  await joinUI(page);
  const resumedId = (await stored(page)).participantId;
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.reload();
    await page.waitForURL("**/?roomCode=*");
    await count(1);
    assert.equal((await stored(page)).participantId, resumedId);
    await joinUI(page);
    assert.equal((await stored(page)).participantId, resumedId);
    await count(2);
  }
  checks.push("three-refreshes-same-identity-no-duplicate");
  await page.evaluate(() => window.dicereRoomSocket.close());
  await page.waitForURL("**/?roomCode=*");
  await count(1);
  await joinUI(page);
  assert.equal((await stored(page)).participantId, resumedId);
  await count(2);
  checks.push("transport-loss-and-resume");
  await page.goBack();
  await page.waitForURL((url) => url.pathname === "/");
  await count(1);
  checks.push("spa-back-navigation-releases-slot");
  await page.goto(`${frontend}/room/${room.code}`);
  await page.waitForURL("**/?roomCode=*");
  await joinUI(page);
  await context.close();
  await count(1);
  await enter(third, "Reconnect Guest");
  await count(2);
  checks.push("closed-browser-replaced-with-same-name");
  console.log(
    JSON.stringify({
      suite: "room-reconnection",
      status: "passed",
      realPublicAPI: true,
      mediaAllowed,
      speechTested: false,
      checks,
    }),
  );
} finally {
  sockets.forEach((socket) => socket.disconnect());
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
