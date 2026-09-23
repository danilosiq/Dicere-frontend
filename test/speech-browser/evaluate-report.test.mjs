import { describe, expect, it } from "vitest";
import { evaluateReport, summarizeAttempts } from "./evaluate-report.mjs";

const report = () => ({
  mocked: false,
  consented: true,
  referenceConfirmed: true,
  speechEndReviewed: false,
  translationReviewed: false,
  cleanupSucceeded: true,
  browserClosed: true,
  browserConnectionClosed: true,
  browserForcedStop: false,
  browserErrors: [],
  runs: [{ exactWords: true, withinBudget: true, upperBoundMs: 3000 }],
});

describe("speech report acceptance", () => {
  it("keeps technical success separate from human acceptance", () => {
    expect(evaluateReport(report(), 0)).toMatchObject({
      executionPassed: true,
      acceptancePassed: false,
    });
    expect(
      evaluateReport(
        { ...report(), speechEndReviewed: true, translationReviewed: true },
        0,
      ).acceptancePassed,
    ).toBe(true);
  });

  it.each([124, 1, null, undefined])(
    "rejects process exit %s even with correct subtitles",
    (exitCode) => {
      expect(evaluateReport(report(), exitCode).executionPassed).toBe(false);
    },
  );

  it.each([
    { failure: "Error" },
    { browserErrors: ["STT_TIMEOUT"] },
    { cleanupSucceeded: false },
    { browserClosed: false },
    { browserConnectionClosed: false },
    { browserForcedStop: true },
    { transportCaptureFailed: true },
    { runs: [] },
    { mocked: true },
    { runs: [{ exactWords: true, withinBudget: true, upperBoundMs: 4001 }] },
    { runs: [{ exactWords: true, withinBudget: true, upperBoundMs: null }] },
    { runs: [{ exactWords: false, withinBudget: true, upperBoundMs: 3000 }] },
  ])("rejects incomplete or failed evidence: %j", (change) => {
    expect(evaluateReport({ ...report(), ...change }, 0).executionPassed).toBe(
      false,
    );
  });

  it("rejects absent reports", () => {
    expect(evaluateReport(null, 0).executionPassed).toBe(false);
  });

  it("retains a failed attempt when a retry succeeds", () => {
    const result = summarizeAttempts([
      { language: "ES", exitCode: 124, report: report() },
      { language: "ES", exitCode: 0, report: report() },
    ]);
    expect(result).toMatchObject({
      attempts: 2,
      executionPassed: 1,
      executionFailed: 1,
      languagesWithSuccessfulAttempt: 1,
      allAttemptsPassed: false,
      acceptancePassed: false,
    });
  });

  it("does not accept an empty matrix", () => {
    expect(summarizeAttempts([]).allAttemptsPassed).toBe(false);
  });
});
