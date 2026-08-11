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
- `src/core/hooks`: hooks compartilhados, incluindo reconhecimento de voz com `react-speech-recognition` e integrações de socket.
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
