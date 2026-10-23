# Silero voice activity detector

- Upstream: https://github.com/snakers4/silero-vad/tree/v5.1.2
- Model: `src/silero_vad/data/silero_vad.onnx`, downloaded from the official v5.1.2 tag.
- Local file: `silero-v5.1.2.onnx` (2,327,524 bytes).
- SHA-256: `2623a2953f6ff3d2c1e61740c6cdb7168133479b267dfef114a4a3cc5bdd788f`.
- License: MIT, Silero Team; full license in `LICENSE` beside the model.

The browser worker evaluates 512 samples at 16 kHz, retaining 64 context samples
and recurrent state within a segment. State resets between segments. At least
250 ms of consecutive probability >= 0.5 is required before Whisper is called.
Only actual samples count; padding cannot satisfy the duration requirement.
The original segment is preserved for recognition, including its pre-roll.

The model is served by Dicere. Its pinned ONNX WebAssembly runtime is loaded
from jsDelivr, like the existing local Whisper runtime. Audio stays in the worker;
it is not uploaded to the model host or CDN. Loading/inference failures use the
existing speech error path and never enable an unfiltered fallback.
