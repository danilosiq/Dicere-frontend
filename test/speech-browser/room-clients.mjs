import { randomUUID } from "node:crypto";
import { installMicrophoneFixture } from "./microphone-fixture.mjs";

export async function createClient(browser, frontendUrl, frontendProxy) {
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
  page.on("websocket", (socket) =>
    socket.on("framereceived", ({ payload }) => {
      if (typeof payload !== "string" || !payload.startsWith("42")) return;
      try {
        const [name, data] = JSON.parse(payload.slice(2));
        if (name === "voice_translation_received")
          client.translations.push(data);
      } catch {
        // Binary audio frames are not events or logs.
      }
    }),
  );
  return client;
}

async function enterDetails(page, name, language, password) {
  await page.getByLabel("Seu nome").fill(name);
  await page
    .getByRole("button", { name: "Selecionar idioma", exact: true })
    .click();
  await page
    .getByRole("option", { name: new RegExp(`\\b${language}$`) })
    .click();
  await page.getByLabel(/^Senha/).fill(password);
}

export async function joinClients(
  clients,
  frontendUrl,
  onCreated,
  existingRoom,
) {
  const [first, second] = clients.map(({ page }) => page);
  const password = existingRoom?.password ?? randomUUID();
  let room = existingRoom;
  if (existingRoom) {
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
          targetLanguage: "IT",
        }),
      );
    }, existingRoom);
    await first.goto(`${frontendUrl}/?roomCode=${existingRoom.code}`);
    await first.getByLabel(/^Senha/).fill(password);
    await first.getByRole("button", { name: "Confirmar", exact: true }).click();
  } else {
    await first.goto(frontendUrl);
    await first
      .getByRole("button", { name: "Criar uma sala", exact: true })
      .click();
    await first.getByLabel("Título da sala").fill("Validação privada STT");
    await enterDetails(first, "Quality IT", "IT", password);
    const created = first.waitForResponse(
      (response) =>
        response.url().endsWith("/room") &&
        response.request().method() === "POST",
    );
    await first.getByRole("button", { name: "Confirmar", exact: true }).click();
    room = (await (await created).json()).data;
    onCreated(room);
  }
  await first.waitForURL("**/room/*");
  await second.goto(`${frontendUrl}/?roomCode=${room.code}`);
  await enterDetails(second, "Quality ES", "ES", password);
  await second.getByRole("button", { name: "Confirmar", exact: true }).click();
  await second.waitForURL("**/room/*");
  for (const { page } of clients) {
    await page
      .getByRole("button", {
        name: "Ativar transcrição nesta sala",
        exact: true,
      })
      .click();
    await page.waitForFunction(() => !!window.dicereFixture);
    await page.waitForTimeout(500);
  }
}
