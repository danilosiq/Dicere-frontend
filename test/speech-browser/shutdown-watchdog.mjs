// This timer never prolongs a healthy run. If another resource keeps Node alive
// after cleanup, preserve that failure before the controller removes the pilot.
export function armShutdownWatchdog(onStalled, timeoutMs = 5000) {
  return setTimeout(() => {
    const resources = {};
    for (const type of process.getActiveResourcesInfo())
      resources[type] = (resources[type] ?? 0) + 1;
    onStalled(resources);
  }, timeoutMs).unref();
}
