import { randomUUID } from "node:crypto";
import { installMicrophoneFixture } from "./microphone-fixture.mjs";
import { createTransportCapture } from "./transport-capture.mjs";

export async function createClient(
  browser,
  frontendUrl,
  frontendProxy,
  saveTransport,
) {
  const context = await browser.newContext({
    locale: "pt-BR",
    permissions: ["camera", "microphone"],
    viewport: { width: 1440, height: 1000 },
  });
  await context.addInitScript(installMicrophoneFixture);
  if (frontendProxy) {
    await context.route(`${frontendUrl}/**`, async (route) => {
      const requested = new URL(route.request().url());
      const response = await route.fetch({
        url: `${frontendProxy}${requested.pathname}${requested.search}`,
        maxRedirects: 0,
      });
      await route.fulfill({ response });
    });
  }
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const client = { page, translations: [], rendered: [], errors: [] };
  await page.exposeFunction("dicereRendered", (event) =>
    client.rendered.push(event),
  );
  page.on("pageerror", (error) => client.errors.push(error.name));
  page.on("console", async (message) => {
    if (!message.text().startsWith("[Dicere][ServerSpeech]")) return;
    const detail = await message
      .args()[1]
      ?.jsonValue()
      .catch(() => null);
    if (typeof detail?.code === "string" && /^STT_[A-Z_]+$/.test(detail.code))
      client.errors.push(detail.code);
  });
  page.on("websocket", (socket) => {
    if (saveTransport) {
      const capture = createTransportCapture(saveTransport);
      socket.on("framesent", ({ payload }) => capture(payload));
    }
    socket.on("framereceived", ({ payload }) => {
      if (typeof payload !== "string" || !payload.startsWith("42")) return;
      try {
        const [name, data] = JSON.parse(payload.slice(2));
        if (name === "voice_translation_received")
          client.translations.push(data);
      } catch {
        // Binary audio frames are not events or logs.
      }
    });
  });
  return client;
}

function languageOption(page, language) {
  const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return page
    .getByRole("option")
    .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) });
}

async function enterDetails(page, name, language, password) {
  await page.getByLabel("Seu nome").fill(name);
  await page
    .getByRole("button", { name: "Selecionar idioma", exact: true })
    .click();
  await languageOption(page, language).click();
  await page.getByLabel(/^Senha/).fill(password);
}

export async function joinClients(
  clients,
  frontendUrl,
  onCreated,
  existingRoom,
) {
  const stage = (value) => console.info("BROWSER_JOIN_STAGE", value);
  const [first, second] = clients.map(({ page }) => page);
  const password = existingRoom?.password ?? randomUUID();
  let room = existingRoom;
  if (existingRoom) {
    stage("admin-navigation");
    onCreated(existingRoom);
    await first.addInitScript((seed) => {
      window.sessionStorage.setItem(
        "dicere-room-session",
        JSON.stringify({
          roomId: seed.roomId,
          roomCode: seed.code,
          roomTitle: seed.title,
          roomStatus: "ACTIVE",
          participantId: seed.adminParticipantId,
          nickname: "Quality IT",
          role: "ADM",
          targetLanguage: seed.targetLanguage,
        }),
      );
    }, existingRoom);
    stage("admin-goto");
    await first.goto(frontendUrl);
    await first.getByRole("button", { name: "Entrar na sala", exact: true }).click();
    await first.waitForTimeout(500);
    stage(`admin-url:${await first.url()}`);
    stage(`admin-inputs:${await first.locator("input").count()}`);
    await first.getByLabel("Código da sala").fill(existingRoom.code);
    await first.getByLabel("Seu nome").fill(`Quality ${existingRoom.targetLanguage ?? "IT"}`);
    await first
      .getByRole("button", { name: "Selecionar idioma", exact: true })
      .click();
    await languageOption(
      first,
      existingRoom.targetLanguage ?? "IT",
    ).click();
    stage("admin-password");
    await first.getByLabel(/^Senha/).fill(password);
    stage("admin-confirm");
    await first.getByRole("button", { name: "Confirmar", exact: true }).click();
  } else {
    stage("room-creation");
    await first.goto(frontendUrl);
    await first
      .getByRole("button", { name: "Criar uma sala", exact: true })
      .click();
    await first.getByLabel("Título da sala").fill("Validação privada STT");
    await enterDetails(
      first,
      `Quality ${existingRoom?.targetLanguage ?? process.env.SPEECH_TEST_TARGET_LANGUAGE ?? "IT"}`,
      existingRoom?.targetLanguage ?? process.env.SPEECH_TEST_TARGET_LANGUAGE ?? "IT",
      password,
    );
    const created = first.waitForResponse(
      (response) =>
        response.url().endsWith("/room") &&
        response.request().method() === "POST",
    );
    await first.getByRole("button", { name: "Confirmar", exact: true }).click();
    room = (await (await created).json()).data;
    onCreated(room);
  }
  stage("admin-room-ready");
  await first.waitForURL("**/room/*");
  stage("guest-navigation");
  const language = existingRoom?.targetLanguage ?? process.env.SPEECH_TEST_TARGET_LANGUAGE ?? "IT";
  await second.goto(frontendUrl);
  await second.getByRole("button", { name: "Entrar na sala", exact: true }).click();
  await second.waitForTimeout(500);
  await second.getByLabel("Código da sala").fill(room.code);
  await enterDetails(second, `Quality ${language} Guest`, language, password);
  await second.getByRole("button", { name: "Confirmar", exact: true }).click();
  stage(`guest-after-confirm:${await second.url()}`);
  try {
    await second.waitForURL("**/room/*");
  } catch (error) {
    console.error("BROWSER_GUEST_JOIN_FAILED", await second.locator("body").innerText().catch(() => ""));
    throw error;
  }
  stage("guest-room-ready");
  for (const { page } of clients) {
    stage("speech-consent");
    try {
      await page
        .getByRole("button", {
          name: "Ativar transcrição nesta sala",
          exact: true,
        })
        .click();
    } catch (error) {
      console.error("BROWSER_SPEECH_CONSENT_FAILED", await page.locator("body").innerText().catch(() => ""));
      throw error;
    }
    await page.waitForFunction(() => !!window.dicereFixture);
    await page.waitForTimeout(500);
  }
}
