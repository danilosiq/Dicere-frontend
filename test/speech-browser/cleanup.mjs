export async function closeBrowser(browser, onStage = () => {}) {
  if (!browser) return;
  onStage("contexts-closing");
  const results = await Promise.allSettled(
    browser.contexts().map(async (context, index) => {
      try {
        await Promise.all(
          context
            .pages()
            .map((page) =>
              page.evaluate(() => window.disposeDicereFixture?.()),
            ),
        );
      } finally {
        await context.close();
        onStage(`context-${index}-closed`);
      }
    }),
  );
  onStage("browser-closing");
  await browser.close();
  onStage("browser-closed");
  if (results.some((result) => result.status === "rejected"))
    throw new Error("BROWSER_CONTEXT_CLEANUP_FAILED");
}

async function bounded(action, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(action),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function cleanup({ closeRoom, closeBrowser, timeoutMs = 10000 }) {
  const cleanupSucceeded = await bounded(closeRoom, timeoutMs);
  const browserClosed = await bounded(async () => {
    await closeBrowser();
    return true;
  }, timeoutMs);
  return { cleanupSucceeded, browserClosed };
}
