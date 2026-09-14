# Dicere — front-end

Base do front-end construída com Next.js App Router, React, TypeScript e npm.

## Requisitos

- Node.js 22.13.0 (`.nvmrc`)
- npm 11.6.2

## Comandos

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck
npm run format
```

Copie `.env.example` para `.env.local` e ajuste os endpoints antes de iniciar.

## Organização

- `src/app`: rotas, layouts, API routes e providers do App Router.
- `src/components`: componentes globais usados por múltiplas features e shadcn/ui.
- `src/features`: páginas e código específico de cada domínio.
- `src/core/hooks`: hooks compartilhados, incluindo transcrição local com Transformers.js e integrações de socket.
- `src/core/services`: clientes compartilhados de HTTP e Socket.IO.
- `src/core/store`: estado global Zustand.
- `src/styles`: tokens de cor, tipografia e temas.
- `src/@types`: tipos compartilhados.
- `src/utils`: utilitários sem regra de negócio.

## Convenções

- Arquivos e pastas usam kebab-case; componentes exportados usam PascalCase.
- Chamadas HTTP ficam em services; hooks TanStack Query apenas orquestram esses services.
- Socket.IO é criado em `src/services/socket-client.ts` e consumido por hooks.
- Componentes específicos permanecem dentro da feature; só sobem para `components` quando forem reutilizados por pelo menos três features.
- O tema usa variáveis CSS e a classe `dark` no elemento `html`.

## Transcrição local de voz

O fluxo é microfone → texto no navegador → `translate_speech` → API/DeepL →
`voice_translation_received`. Não utiliza o reconhecedor remoto do Chrome nem
Deepgram. O áudio usado para transcrição não é enviado a um fornecedor de STT;
o áudio da chamada WebRTC continua sendo transmitido ao outro participante.

- Transformers.js 3.8.1 e `onnx-community/whisper-tiny` multilíngue q8, com revisão
  fixa no worker. Inferência WASM em uma thread, sem exigir WebGPU ou isolamento
  entre origens.
- O primeiro uso baixa o modelo do Hugging Face; downloads posteriores podem usar
  o cache do navegador. HTTPS, Worker, AudioContext, AudioWorklet e permissão de
  microfone são necessários.
- AudioWorklet captura PCM; o segmentador converte para mono 16 kHz, ignora
  silêncio e envia trechos após aproximadamente 650 ms de silêncio ou 6 s de fala.
- A fila aceita até três trechos aguardando inferência. Sobrecarga é informada,
  não ocultada em uma fila crescente. O modelo tem limite de preparo de 120 s;
  microfone, 60 s; inferência de cada trecho, 30 s.
- Sair, silenciar ou mudar de sala/idioma encerra o worker e o microfone da
  transcrição. Resultados de sessões canceladas não são enviados.
- Erros aparecem na legenda com nova tentativa manual e nos diagnósticos
  `[Dicere][LocalSpeech]` e `[Dicere][SpeechRecognition]`, sem texto falado ou áudio.

O processamento ocorre em trechos, não palavra por palavra. Qualidade e latência
dependem do áudio, idioma e dispositivo. O download inicial e a API de tradução
continuam dependendo de rede; não há garantia de disponibilidade de 100%.
