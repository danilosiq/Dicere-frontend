import { Button } from "@/core/components/button";
import { Typography } from "@/core/components/typography";

export function SpeechPrivacyNotice({ onAccept }: { onAccept: () => void }) {
  return (
    <section
      aria-label="Privacidade da transcrição"
      className="absolute inset-x-4 bottom-4 z-20 flex max-w-lg flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm dark:bg-gray-800"
    >
      <Typography fontWeight="semibold">
        Novo reconhecimento de voz em teste
      </Typography>
      <Typography size="sm">
        Ao ativar, sua voz será enviada ao servidor do Dicere para transcrição,
        sem salvar gravações. O texto continua sendo enviado à DeepL para
        tradução. O teste aceita português brasileiro e pausa quando esta aba
        fica oculta.
      </Typography>
      <Button label="Ativar transcrição nesta sala" onClick={onAccept} />
    </section>
  );
}
