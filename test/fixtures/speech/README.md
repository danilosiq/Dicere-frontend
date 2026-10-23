# Synthetic speech controls

These mono, 16 kHz, PCM16 WAVE files were synthesized locally with macOS `say`,
voice Luciana, rate 160, on 2026-10-22. They contain only their named Portuguese
word: `Obrigado.`, `Tchau.`, `Oi.`. There is no recorded human voice or user audio.

Generation example:

```sh
say -v Luciana -r 160 -o /tmp/obrigado.aiff 'Obrigado.'
afconvert /tmp/obrigado.aiff -o obrigado.wav -f WAVE -d LEI16@16000 -c 1
```

`test:local-speech-noise` uses the actual browser Silero model and these files
to check that speech is admitted. Its ASR callback is deliberately a spy. This
checks audio admission and delivery, not Whisper word accuracy. The test also
generates deterministic repeated snaps, decaying claps, noise, tone and silence.
