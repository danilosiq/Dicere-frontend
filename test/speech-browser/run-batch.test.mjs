import { expect, it } from "vitest";
import { runBatch, summarizeOverlap } from "./run-batch.mjs";

it("starts both speakers together and waits for the other after a failure", async () => {
  const started = [];
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  const batch = runBatch(true, async (sender) => {
    started.push(sender);
    if (sender === 0) throw new Error("FAILED");
    await pending;
    return sender;
  });
  expect(started).toEqual([0, 1]);
  let settled = false;
  void batch.then(() => {
    settled = true;
  });
  await Promise.resolve();
  expect(settled).toBe(false);
  finish();
  expect((await batch).map((result) => result.status)).toEqual([
    "rejected",
    "fulfilled",
  ]);
});

it("keeps sequential execution as the default mode", async () => {
  const events = [];
  await runBatch(false, async (sender) => {
    events.push(`start${sender}`);
    await Promise.resolve();
    events.push(`end${sender}`);
  });
  expect(events).toEqual(["start0", "end0", "start1", "end1"]);
});

it("only reports overlap proven after clock uncertainty", () => {
  const make = (start) => ({
    scheduled: { start, durationMs: 5000, uncertaintyMs: 20 },
    senderClock: { offset: 100, uncertainty: 5 },
  });
  expect(summarizeOverlap([make(1000), make(1010)])).toEqual({
    startSkewMs: 10,
    minimumOverlapMs: 4940,
  });
  expect(summarizeOverlap([make(1000), make(6100)]).minimumOverlapMs).toBe(0);
  expect(summarizeOverlap([make(1000)])).toBeNull();
});
