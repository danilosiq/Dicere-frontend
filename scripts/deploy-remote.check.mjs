import assert from "node:assert/strict";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const digest = "a".repeat(64);
const image = "ghcr.io/danilosiq/dicere-test@sha256:" + digest;
const mock = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv.slice(2);
const mode = process.env.CD_TEST_MODE;
fs.appendFileSync(process.env.CD_TEST_LOG, JSON.stringify(args) + "\\n");
if (args[0] === "login") {
  fs.writeFileSync(process.env.CD_TEST_CONFIG_LOG, process.env.DOCKER_CONFIG);
  fs.writeFileSync(process.env.DOCKER_CONFIG + "/config.json", "temporary-test-auth");
  if (mode === "login-failed") process.exit(1);
}
if (args[0] === "compose" && args.includes("ps")) {
  if (mode !== "missing-service") console.log("container-1");
} else if (args[0] === "inspect") {
  const format = args[2];
  const log = fs.readFileSync(process.env.CD_TEST_LOG, "utf8");
  const updating = log.includes('"up"');
  console.log(format.includes("Config.Image") ? "old:release" :
    format.includes("Health.Status") ? "healthy" :
    updating && mode !== "wrong-image" ? "sha256:new" : "sha256:old");
} else if (args[0] === "image") {
  console.log(args.includes("{{.Id}}") ? "sha256:new" : '["CMD","node","health"]');
} else if (args[0] === "pull" && mode === "pull-failed") {
  process.exit(1);
} else if (args[0] === "compose" && args.includes("up") && mode === "unhealthy") {
  const attempts = fs.readFileSync(process.env.CD_TEST_LOG, "utf8").split("\\n").filter(x => x.includes('"up"')).length;
  if (attempts === 1) process.exit(1);
}
`;

for (const mode of [
  "success",
  "unhealthy",
  "wrong-image",
  "pull-failed",
  "missing-service",
  "login-failed",
]) {
  test("deploy: " + mode, () => {
    const dir = mkdtempSync(join(tmpdir(), "dicere-cd-test-"));
    try {
      const bin = join(dir, "bin");
      mkdirSync(bin);
      writeFileSync(join(bin, "docker"), mock, { mode: 0o700 });
      writeFileSync(join(bin, "flock"), "#!/bin/sh\nexit 0\n", { mode: 0o700 });
      const compose = join(dir, "compose.yml");
      writeFileSync(compose, "services:\n  app:\n    image: old:release\n");
      mkdirSync(join(dir, ".dicere-cd"));
      const sibling = '{"services":{"peer":{"image":"existing:peer"}}}\n';
      writeFileSync(join(dir, ".dicere-cd", "peer.json"), sibling);
      const log = join(dir, "calls.jsonl");
      const configLog = join(dir, "config-path");
      const result = spawnSync(
        "bash",
        [resolve("scripts/deploy-remote.sh"), image, compose, "dicere", "app"],
        {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: bin + ":" + process.env.PATH,
            CD_TEST_LOG: log,
            CD_TEST_MODE: mode,
            CD_TEST_CONFIG_LOG: configLog,
            GHCR_USER: "test-user",
            GHCR_TOKEN: "test-token-never-log",
          },
        },
      );
      assert.equal(result.status, mode === "success" ? 0 : 1, result.stderr);
      if (mode !== "missing-service") {
        assert.ok(existsSync(configLog), "Temporary registry login must run");
        assert.equal(existsSync(readFileSync(configLog, "utf8")), false);
      }
      assert.ok(
        !(result.stdout + result.stderr + readFileSync(log, "utf8")).includes(
          "test-token-never-log",
        ),
      );
      const calls = readFileSync(log, "utf8")
        .trim()
        .split("\n")
        .map((x) => JSON.parse(x));
      const updates = calls.filter(
        (x) => x[0] === "compose" && x.includes("up"),
      );
      if (mode === "success") {
        assert.equal(updates.length, 1);
        const saved = JSON.parse(
          readFileSync(join(dir, ".dicere-cd", "app.json"), "utf8"),
        );
        assert.equal(saved.services.app.image, image);
        assert.ok(result.stdout.includes("Deploy confirmado"));
      } else if (mode === "unhealthy" || mode === "wrong-image") {
        assert.equal(updates.length, 2);
        const saved = JSON.parse(
          readFileSync(join(dir, ".dicere-cd", "app.json"), "utf8"),
        );
        assert.equal(
          saved.services.app.image,
          "dicere-rollback/dicere-app:previous",
        );
      } else {
        assert.equal(updates.length, 0);
      }
      for (const update of updates) {
        assert.equal(update.at(-1), "app");
        for (const flag of ["--no-deps", "--no-build", "--wait"])
          assert.ok(update.includes(flag));
        assert.ok(update.includes(".dicere-cd/peer.json"));
      }
      assert.equal(
        readFileSync(join(dir, ".dicere-cd", "peer.json"), "utf8"),
        sibling,
      );
      assert.ok(!calls.some((x) => x.includes("down") || x.includes("prune")));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
