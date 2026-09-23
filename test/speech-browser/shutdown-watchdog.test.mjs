import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const moduleUrl = pathToFileURL(
  resolve("test/speech-browser/shutdown-watchdog.mjs"),
).href;
function run(extra = "") {
  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { armShutdownWatchdog } from ${JSON.stringify(moduleUrl)};
       armShutdownWatchdog((resources) => {
         console.log(JSON.stringify({ stalled: true, resources }));
         process.exit(1);
       }, 50);
       ${extra}`,
    ],
    { encoding: "utf8", timeout: 3000 },
  );
}

describe("browser executor shutdown watchdog", () => {
  it("does not keep a clean process alive or mark it failed", () => {
    const result = run();
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  });

  it("records and fails a process retained by a leaked resource", () => {
    const result = run("setInterval(() => {}, 10000);");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(1);
    expect(result.signal).toBeNull();
    const evidence = JSON.parse(result.stdout);
    expect(evidence.stalled).toBe(true);
    expect(evidence.resources.Timeout).toBeGreaterThan(0);
    expect(Object.values(evidence.resources).every(Number.isInteger)).toBe(
      true,
    );
  });
});
