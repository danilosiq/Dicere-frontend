// Wait for both attempts even after a rejection, before closing their browsers.
export async function runBatch(simultaneous, measure, senders = [0, 1]) {
  if (simultaneous) return Promise.allSettled(senders.map(measure));
  const results = [];
  for (const sender of senders) {
    results.push(...(await Promise.allSettled([measure(sender)])));
  }
  return results;
}

export function summarizeOverlap(runs) {
  if (runs.length !== 2) return null;
  const intervals = runs.map(({ scheduled, senderClock }) => {
    const start = scheduled.start + senderClock.offset;
    const uncertainty = scheduled.uncertaintyMs + senderClock.uncertainty;
    return {
      start,
      latestStart: start + uncertainty,
      earliestEnd: start + scheduled.durationMs - uncertainty,
    };
  });
  return {
    startSkewMs: Math.abs(intervals[0].start - intervals[1].start),
    minimumOverlapMs: Math.max(
      0,
      Math.min(...intervals.map((item) => item.earliestEnd)) -
        Math.max(...intervals.map((item) => item.latestStart)),
    ),
  };
}
