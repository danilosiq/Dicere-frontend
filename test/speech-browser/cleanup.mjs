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
