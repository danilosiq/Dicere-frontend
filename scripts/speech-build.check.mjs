import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("Docker build refuses the unapproved global speech switch", () => {
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
    assert.equal(result.status, value === "false" ? 0 : 1);
    if (value !== "false")
      assert.match(result.stderr, /^STT_PUBLIC_RELEASE_BLOCKED\n$/);
  }
});
