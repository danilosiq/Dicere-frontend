// Only replaces the microphone input. STT, Socket.IO and DeepL remain real.
export function installMicrophoneFixture() {
  const native = navigator.mediaDevices.getUserMedia.bind(
    navigator.mediaDevices,
  );
  navigator.mediaDevices.getUserMedia = async (constraints) => {
    if (constraints.video !== false || !constraints.audio)
      return native(constraints);
    const context = new AudioContext({ sampleRate: 16000 });
    await context.resume();
    const destination = context.createMediaStreamDestination();
    window.dicereFixture = { context, destination };
    return destination.stream;
  };
  window.playDicereFixture = (encoded) => {
    const { context, destination } = window.dicereFixture;
    const bytes = Uint8Array.from(atob(encoded), (value) =>
      value.charCodeAt(0),
    );
    const view = new DataView(bytes.buffer);
    const buffer = context.createBuffer(1, bytes.length / 2, 16000);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++)
      channel[i] = view.getInt16(i * 2, true) / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    const before = performance.now();
    const when = context.currentTime + 0.25;
    const start = performance.now() + 250;
    source.start(when);
    return {
      start,
      durationMs: buffer.duration * 1000,
      uncertaintyMs:
        performance.now() -
        before +
        1000 *
          (context.baseLatency + (context.outputLatency || 0) + 128 / 16000),
    };
  };
  window.addEventListener("DOMContentLoaded", () => {
    const seen = new Set();
    new MutationObserver(() => {
      const feed = document.querySelector('[aria-label="Legenda traduzida"]');
      for (const item of feed?.children || []) {
        const id = item.dataset.speechSegmentId;
        if (!id || seen.has(id) || !item.textContent.trim()) continue;
        seen.add(id);
        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            window.dicereRendered({
              segmentId: id,
              text: item.textContent.trim(),
              at: performance.now(),
            }),
          ),
        );
      }
    }).observe(document.documentElement, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });
}

// Maps each browser's monotonic clock to the controller; never subtracts clocks
// from separate machines. Best round-trip bounds are retained, not assumed zero.
export async function calibrateClock(page) {
  let best;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const remote = await page.evaluate(() => performance.now());
    const end = performance.now();
    const sample = {
      offset: (start + end) / 2 - remote,
      uncertainty: (end - start) / 2,
    };
    if (!best || sample.uncertainty < best.uncertainty) best = sample;
  }
  return best;
}
