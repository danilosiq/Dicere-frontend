/** Same averaging resampler as the local engine; input boundaries are now stable. */
export function resampleLocalSpeech(source: Float32Array, sampleRate: number) {
  if (sampleRate === 16000) return source;
  const ratio = sampleRate / 16000;
  const result = new Float32Array(Math.floor(source.length / ratio));
  for (let index = 0; index < result.length; index++) {
    const start = Math.floor(index * ratio);
    const end = Math.min(
      source.length,
      Math.max(start + 1, Math.floor((index + 1) * ratio)),
    );
    let sum = 0;
    for (let cursor = start; cursor < end; cursor++) sum += source[cursor];
    result[index] = sum / (end - start);
  }
  return result;
}
