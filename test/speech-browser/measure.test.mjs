import { describe, expect, it } from "vitest";
import { summarizeRun } from "./measure.mjs";

const sample = {
  translations: [{ originalText: "Como que tá?" }],
  rendered: [{ at: 8200 }],
  scheduled: { start: 1000, uncertaintyMs: 50 },
  senderClock: { offset: 100, uncertainty: 5 },
  receiverClock: { offset: 200, uncertainty: 5 },
};

describe("real browser speech evidence", () => {
  it("uses the earliest possible speech end and both clock uncertainties", () => {
    expect(summarizeRun(sample, "Como que tá?", 80000)).toEqual({
      exactWords: true,
      segments: 1,
      upperBoundMs: 2360,
      withinBudget: true,
    });
  });
  it("never normalizes informal speech into formal speech", () => {
    expect(summarizeRun(sample, "Como que está?", 80000).exactWords).toBe(
      false,
    );
  });
  it("retains timeouts and violations instead of treating them as fast responses", () => {
    expect(
      summarizeRun({ ...sample, rendered: [] }, "Como que tá?", 80000)
        .withinBudget,
    ).toBe(false);
    expect(summarizeRun(sample, "Como que tá?", 16000).withinBudget).toBe(
      false,
    );
  });
});
