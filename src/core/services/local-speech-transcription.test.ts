import { describe, expect, it, vi } from "vitest";
import { transcribeLocalSpeech } from "./local-speech-transcription";

describe("local audio to text admission", () => {
  it("does not run Whisper or publish text for non-speech", async () => {
    const asr = vi.fn().mockResolvedValue({ text: "Obrigado." });
    expect(
      await transcribeLocalSpeech(
        new Float32Array(16000),
        "pt-BR",
        { hasSpeech: async () => false },
        asr,
      ),
    ).toBe("");
    expect(asr).not.toHaveBeenCalled();
  });

  it.each(["Obrigado.", "Tchau.", "Oi!", "Não."])(
    "preserves real short utterances: %s",
    async (text) => {
      const asr = vi.fn().mockResolvedValue({ text: ` ${text} ` });
      const audio = new Float32Array(16000);
      expect(
        await transcribeLocalSpeech(
          audio,
          "pt-BR",
          { hasSpeech: async () => true },
          asr,
        ),
      ).toBe(text);
      expect(asr).toHaveBeenCalledWith(
        audio,
        expect.objectContaining({ language: "pt", task: "transcribe" }),
      );
    },
  );

  it.each(["[MÚSICA]", "(música)", "[sobido]", "♪", "[silêncio] (ruído)"])(
    "does not translate an annotation with no spoken words: %s",
    async (text) => {
      expect(
        await transcribeLocalSpeech(
          new Float32Array(16000),
          "pt",
          { hasSpeech: async () => true },
          vi.fn().mockResolvedValue({ text }),
        ),
      ).toBe("");
    },
  );

  it("keeps spoken text alongside an annotation and maps Norwegian", async () => {
    const asr = vi.fn().mockResolvedValue([{ text: "Hei (venn)." }]);
    expect(
      await transcribeLocalSpeech(
        new Float32Array(16000),
        "nb-NO",
        { hasSpeech: async () => true },
        asr,
      ),
    ).toBe("Hei (venn).");
    expect(asr).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ language: "no" }),
    );
  });

  it("propagates VAD failures instead of silently admitting noise", async () => {
    const asr = vi.fn();
    await expect(
      transcribeLocalSpeech(
        new Float32Array(16000),
        "pt",
        {
          hasSpeech: async () => {
            throw new Error("VadFailed");
          },
        },
        asr,
      ),
    ).rejects.toThrow("VadFailed");
    expect(asr).not.toHaveBeenCalled();
  });
});
