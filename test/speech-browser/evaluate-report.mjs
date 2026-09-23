// Technical execution and human acceptance are different gates. Retries never
// replace failed attempts when producing the matrix summary.
export function evaluateReport(report, exitCode) {
  const runs = report?.runs;
  const speechPassed =
    Array.isArray(runs) &&
    runs.length > 0 &&
    runs.every(
      (run) =>
        run.exactWords === true &&
        run.withinBudget === true &&
        Number.isFinite(run.upperBoundMs) &&
        run.upperBoundMs >= 0 &&
        run.upperBoundMs <= 4000 &&
        !run.failure,
    );
  const executionPassed =
    exitCode === 0 &&
    speechPassed &&
    report.mocked === false &&
    !report.failure &&
    !report.transportCaptureFailed &&
    Array.isArray(report.browserErrors) &&
    report.browserErrors.length === 0 &&
    report.cleanupSucceeded === true &&
    report.browserClosed === true &&
    report.browserConnectionClosed === true &&
    report.browserForcedStop === false;
  const acceptancePassed =
    executionPassed &&
    report.consented === true &&
    report.referenceConfirmed === true &&
    report.speechEndReviewed === true &&
    report.translationReviewed === true;
  return {
    speechPassed: Boolean(speechPassed),
    executionPassed: Boolean(executionPassed),
    acceptancePassed: Boolean(acceptancePassed),
  };
}

export function summarizeAttempts(attempts) {
  const evaluations = attempts.map((attempt) => ({
    language: attempt.language,
    ...evaluateReport(attempt.report, attempt.exitCode),
  }));
  const passed = evaluations.filter((attempt) => attempt.executionPassed);
  return {
    attempts: attempts.length,
    executionPassed: passed.length,
    executionFailed: attempts.length - passed.length,
    languagesWithSuccessfulAttempt: new Set(
      passed.map((attempt) => attempt.language),
    ).size,
    allAttemptsPassed: attempts.length > 0 && passed.length === attempts.length,
    acceptancePassed:
      attempts.length > 0 &&
      evaluations.every((attempt) => attempt.acceptancePassed),
  };
}
