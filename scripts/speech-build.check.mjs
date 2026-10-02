import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Docker build accepts explicit rollout values and rejects malformed switches", () => {
  const dockerfile = readFileSync("Dockerfile", "utf8");
  const gate = dockerfile.match(
    /RUN (if \[ "\$NEXT_PUBLIC_SPEECH_SERVER_ENABLED"[^]*?\n\s*fi)/,
  )?.[1];
  assert.ok(gate, "mandatory release gate missing from Dockerfile");
  for (const value of ["false", "true", ""]) {
    const result = spawnSync("sh", ["-c", gate.replaceAll("\\\n", "\n")], {
      encoding: "utf8",
      env: { NEXT_PUBLIC_SPEECH_SERVER_ENABLED: value },
    });
    assert.equal(result.status, value === "" ? 1 : 0);
    if (value === "")
      assert.match(result.stderr, /^STT_INVALID_CONFIGURATION\n$/);
  }
});
