import { expect, it, vi } from "vitest";
import { stopOwnedBrowser } from "./browser-process.mjs";
import { EventEmitter } from "node:events";

it("waits for a late process exit after graceful close resolves", async () => {
  const state = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
  });
  const server = {
    process: () => state,
    close: async () => {
      setTimeout(() => {
        state.exitCode = 0;
        state.emit("exit", 0);
      }, 5);
    },
    kill: vi.fn(),
  };
  expect(await stopOwnedBrowser(server, 100)).toEqual({
    browserClosed: true,
    browserForcedStop: false,
  });
  expect(server.kill).not.toHaveBeenCalled();
  expect(state.listenerCount("exit")).toBe(0);
});

it("still forces an owned process that never exits and removes the wait listener", async () => {
  const state = Object.assign(new EventEmitter(), {
    exitCode: null,
    signalCode: null,
  });
  const server = {
    process: () => state,
    close: async () => {},
    kill: vi.fn(async () => {
      state.signalCode = "SIGKILL";
    }),
  };
  expect(await stopOwnedBrowser(server, 5)).toEqual({
    browserClosed: true,
    browserForcedStop: true,
  });
  expect(server.kill).toHaveBeenCalledOnce();
  expect(state.listenerCount("exit")).toBe(0);
});

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
