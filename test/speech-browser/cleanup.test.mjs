import { expect, it, vi } from "vitest";
import { cleanup, closeBrowser } from "./cleanup.mjs";

it("closes explicit browser contexts before the browser process", async () => {
  const events = [];
  await closeBrowser({
    contexts: () => [
      {
        pages: () => [{ evaluate: async () => events.push("fixture") }],
        close: async () => {
          events.push("context");
        },
      },
    ],
    close: async () => {
      events.push("browser");
    },
  });
  expect(events).toEqual(["fixture", "context", "browser"]);
});

it("reports fixture failure but still closes the context and browser", async () => {
  const closed = [];
  await expect(
    closeBrowser({
      contexts: () => [
        {
          pages: () => [
            {
              evaluate: async () => {
                throw new Error("fixture");
              },
            },
          ],
          close: async () => closed.push("context"),
        },
      ],
      close: async () => closed.push("browser"),
    }),
  ).rejects.toThrow("BROWSER_CONTEXT_CLEANUP_FAILED");
  expect(closed).toEqual(["context", "browser"]);
});

it("closes the owned room before a browser that never closes", async () => {
  const events = [];
  const result = await cleanup({
    closeRoom: async () => {
      events.push("room");
      return true;
    },
    closeBrowser: () => {
      events.push("browser");
      return new Promise(() => {});
    },
    timeoutMs: 5,
  });
  expect(events).toEqual(["room", "browser"]);
  expect(result).toEqual({ cleanupSucceeded: true, browserClosed: false });
});

it("still closes the browser when the room cleanup fails", async () => {
  const closeBrowser = vi.fn().mockResolvedValue(undefined);
  expect(
    await cleanup({
      closeRoom: async () => {
        throw new Error("NETWORK");
      },
      closeBrowser,
      timeoutMs: 5,
    }),
  ).toEqual({ cleanupSucceeded: false, browserClosed: true });
  expect(closeBrowser).toHaveBeenCalledOnce();
});
