import { expect, it, vi } from "vitest";
import { stopOwnedBrowser } from "./browser-process.mjs";

it("does not kill a browser that closes normally", async () => {
  const state = { exitCode: null, signalCode: null };
  const server = {
    process: () => state,
    close: async () => {
      state.exitCode = 0;
    },
    kill: vi.fn(),
  };
  expect(await stopOwnedBrowser(server, 5)).toEqual({
    browserClosed: true,
    browserForcedStop: false,
  });
  expect(server.kill).not.toHaveBeenCalled();
});

it("kills only the owned process if graceful shutdown stalls", async () => {
  const state = { exitCode: null, signalCode: null };
  const server = {
    process: () => state,
    close: () => new Promise(() => {}),
    kill: vi.fn(async () => {
      state.signalCode = "SIGKILL";
    }),
  };
  expect(await stopOwnedBrowser(server, 5)).toEqual({
    browserClosed: true,
    browserForcedStop: true,
  });
  expect(server.kill).toHaveBeenCalledOnce();
});

it("does not claim cleanup when the process remains alive", async () => {
  const server = {
    process: () => ({ exitCode: null, signalCode: null }),
    close: async () => {
      throw new Error("FAIL");
    },
    kill: async () => {
      throw new Error("FAIL");
    },
  };
  expect(await stopOwnedBrowser(server, 5)).toEqual({
    browserClosed: false,
    browserForcedStop: true,
  });
});
