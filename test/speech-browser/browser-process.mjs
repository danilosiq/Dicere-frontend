async function attempt(action, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve()
        .then(action)
        .then(() => true),
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

// The server is returned by this test's launchServer, never a user's Chrome.
export async function stopOwnedBrowser(server, timeoutMs = 10000) {
  if (!server) return { browserClosed: true, browserForcedStop: false };
  const deadline = performance.now() + timeoutMs;
  const child = server.process();
  const exited = () => {
    return child.exitCode !== null || child.signalCode !== null;
  };
  const graceful = await attempt(() => server.close(), timeoutMs);
  // Remote browser.close() can resolve before Node observes the process exit.
  // Use the remaining shutdown budget, not an immediate forced kill.
  if (graceful && !exited() && performance.now() < deadline)
    await waitForExit(child, deadline - performance.now());
  const browserForcedStop = !graceful || !exited();
  if (browserForcedStop) await attempt(() => server.kill(), timeoutMs);
  return { browserClosed: exited(), browserForcedStop };
}

function waitForExit(child, timeoutMs) {
  if (typeof child.once !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      child.removeListener("exit", finish);
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    child.once("exit", finish);
    if (child.exitCode !== null || child.signalCode !== null) finish();
  });
}
