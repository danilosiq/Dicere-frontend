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
  const exited = () => {
    const child = server.process();
    return child.exitCode !== null || child.signalCode !== null;
  };
  const graceful = await attempt(() => server.close(), timeoutMs);
  const browserForcedStop = !graceful || !exited();
  if (browserForcedStop) await attempt(() => server.kill(), timeoutMs);
  return { browserClosed: exited(), browserForcedStop };
}
