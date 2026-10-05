import assert from "node:assert/strict";
import { chromium } from "playwright";

// UI-only checks: never creates public rooms or calls speech/translation APIs.
const frontend = process.env.UI_TEST_URL ?? "http://localhost:3106";
const scenarios = [
  {
    browser: "pt-BR",
    locale: "pt-BR",
    site: "Idioma do site",
    create: "Criar uma sala",
    title: "Título da sala",
    target: "Idioma que deseja receber as traduções",
    spoken: "Idioma que você irá falar na chamada",
    cancel: "Cancelar",
    invalid: "O título deve possuir no máximo 50 caracteres",
    chinese: "Chinês",
  },
  {
    browser: "en-US",
    locale: "en",
    site: "Site language",
    create: "Create a room",
    title: "Room title",
    target: "Language you want to receive translations in",
    spoken: "Language you will speak during the call",
    cancel: "Cancel",
    invalid: "The title must be no longer than 50 characters",
    chinese: "Chinese",
  },
  {
    browser: "es-MX",
    locale: "es",
    site: "Idioma del sitio",
    create: "Crear una sala",
    title: "Título de la sala",
    target: "Idioma en el que deseas recibir las traducciones",
    spoken: "Idioma que hablarás en la llamada",
    cancel: "Cancelar",
    invalid: "El título debe tener como máximo 50 caracteres",
    chinese: "Chino",
  },
  {
    browser: "zh-TW",
    locale: "zh-CN",
    site: "网站语言",
    create: "创建房间",
    title: "房间名称",
    target: "你希望接收翻译的语言",
    spoken: "你在通话中使用的语言",
    cancel: "取消",
    invalid: "名称最多包含 50 个字符",
    chinese: "中文",
  },
];
const browser = await chromium.launch({ headless: true });
const notFoundCopy = {
  "pt-BR": ["Página não encontrada", "Voltar ao início"],
  en: ["Page not found", "Back to home"],
  es: ["Página no encontrada", "Volver al inicio"],
  "zh-CN": ["页面未找到", "返回首页"],
};
let checked = 0;
const errors = [];

async function decodeLoadedImage(page, selector, filename) {
  await page.waitForFunction(
    ({ selector, filename }) => {
      const image = document.querySelector(selector);
      return (
        image instanceof HTMLImageElement &&
        image.complete &&
        image.naturalWidth > 0 &&
        image.currentSrc.includes(filename)
      );
    },
    { selector, filename },
  );
  await page.locator(selector).evaluate((image) => image.decode());
}

try {
  // CI starts the production build immediately before this suite.
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      ready = (await fetch(frontend, { signal: AbortSignal.timeout(1000) })).ok;
    } catch {
      /* Server still starting. */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "Frontend did not start in time");
  for (const scenario of scenarios) {
    for (const width of [320, 1440]) {
      for (const theme of ["light", "dark"]) {
        const context = await browser.newContext({
          locale: scenario.browser,
          viewport: { width, height: 1000 },
        });
        await context.addInitScript(
          (theme) => localStorage.setItem("dicere-theme", theme),
          theme,
        );
        const page = await context.newPage();
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(frontend, { waitUntil: "domcontentloaded" });
        await page
          .getByRole("button", { name: scenario.site, exact: true })
          .waitFor();
        assert.equal(
          await page.locator("html").getAttribute("lang"),
          scenario.locale,
        );
        const hero = page.locator('[data-illustration-layer="base"] img');
        const artSuffix =
          scenario.locale === "pt-BR" ? "" : `-${scenario.locale}`;
        assert.ok(
          (await hero.getAttribute("src")).includes(
            `dicere-photo-1${artSuffix}.`,
          ),
          "Hero must use the selected site's language",
        );
        if (scenario.locale !== "pt-BR")
          assert.ok(
            (await hero.getAttribute("src")).includes("/_next/static/media/"),
            "Localized art must not depend on runtime image optimization",
          );
        await decodeLoadedImage(
          page,
          '[data-illustration-layer="base"] img',
          `dicere-photo-1${artSuffix}.`,
        );
        const greetingSelector = `img[src*="salui-guy${artSuffix}."]`;
        const greeting = page.locator(greetingSelector);
        assert.equal(await greeting.count(), 1);
        if (scenario.locale !== "pt-BR")
          assert.ok(
            (await greeting.getAttribute("src")).includes(
              "/_next/static/media/",
            ),
          );
        await decodeLoadedImage(
          page,
          greetingSelector,
          `salui-guy${artSuffix}.`,
        );
        assert.equal(
          await page
            .locator("html")
            .evaluate((html) => html.classList.contains("dark")),
          theme === "dark",
        );
        const create = page.getByRole("button", {
          name: scenario.create,
          exact: true,
        });
        const box = await create.boundingBox();
        assert.ok(
          box && box.x >= 0 && box.x + box.width <= width,
          "Create button is clipped",
        );
        await page
          .getByRole("button", { name: scenario.site, exact: true })
          .click();
        assert.equal(await page.getByRole("option").count(), 4);
        for (const option of await page.getByRole("option").all())
          assert.equal(
            await option.locator("svg").first().count(),
            1,
            "Option needs a flag",
          );
        await page.keyboard.press("Escape");
        await create.click();
        await page
          .getByLabel(scenario.title, { exact: false })
          .fill("X".repeat(51));
        await page
          .getByRole("button", { name: scenario.target, exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: scenario.spoken, exact: true })
          .waitFor();
        // Click the real submit button: translated Zod validation, not browser tooltips.
        await page.locator('form button[type="submit"]').click();
        await page.getByText(scenario.invalid, { exact: true }).waitFor();
        if (scenario.locale === "zh-CN" && width === 320 && theme === "dark")
          await page.screenshot({
            path: "/tmp/dicere-i18n-zh-mobile-dark.png",
          });
        await page
          .getByRole("button", { name: scenario.cancel, exact: true })
          .click();
        const response = await page.goto(
          `${frontend}/localization-test-not-found`,
          { waitUntil: "domcontentloaded" },
        );
        assert.equal(response.status(), 404);
        await page
          .getByText(notFoundCopy[scenario.locale][0], { exact: true })
          .waitFor();
        await page
          .getByRole("button", {
            name: notFoundCopy[scenario.locale][1],
            exact: true,
          })
          .click();
        await page.waitForURL(new URL("/", frontend).href, {
          waitUntil: "domcontentloaded",
        });
        await create.waitFor();
        await page
          .getByRole("button", { name: scenario.site, exact: true })
          .click();
        await page
          .getByRole("option", { name: new RegExp(scenario.chinese + "$") })
          .click();
        assert.equal(
          await page.evaluate(() => localStorage.getItem("dicere-site-locale")),
          "zh-CN",
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await page
          .getByRole("button", { name: "网站语言", exact: true })
          .waitFor();
        assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
        assert.ok(
          (await hero.getAttribute("src")).includes("dicere-photo-1-zh-CN."),
          "Manual language selection must also update the illustration",
        );
        assert.ok(
          (await hero.getAttribute("src")).includes("/_next/static/media/"),
        );
        await decodeLoadedImage(
          page,
          '[data-illustration-layer="base"] img',
          "dicere-photo-1-zh-CN.",
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        await context.close();
        checked++;
        console.log(
          JSON.stringify({
            locale: scenario.locale,
            width,
            theme,
            status: "passed",
          }),
        );
      }
    }
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: checked, pageErrors: errors.length }));
} finally {
  await browser.close();
}
