# Store Flow

Este documento define os padrões para implementação e utilização de stores globais no frontend do Dicere.

O objetivo é manter um estado previsível, organizado e desacoplado, evitando duplicação de dados, responsabilidades incorretas e stores excessivamente grandes.

Toda implementação utilizando Zustand deve seguir este documento.

---

# Objetivo

A store é responsável apenas pelo gerenciamento de estado compartilhado da aplicação.

Ela **não** deve conter regras de negócio, chamadas HTTP ou comunicação Socket.IO.

Toda lógica de negócio deve permanecer nas features, hooks ou services.

---

# Regras gerais

- Utilizar Zustand como gerenciador de estado global.
- Criar stores separadas por domínio.
- Cada store deve possuir responsabilidade única.
- Não criar uma store única contendo toda a aplicação.
- Não duplicar informações existentes no TanStack Query.
- Não armazenar respostas completas da API quando apenas alguns estados forem necessários.
- Não realizar chamadas Axios dentro da store.
- Não criar conexão Socket.IO dentro da store.
- Não implementar regra de negócio dentro da store.
- Não utilizar store para substituir estados locais do React.

---

# Organização

As stores devem ficar em:

```text
src/
└── store/
    ├── room-store.ts
    ├── participant-store.ts
    ├── call-store.ts
    ├── socket-store.ts
    └── ...
```

Cada domínio possui sua própria store.

Exemplos:

- room-store
- participant-store
- call-store
- socket-store

---

# Quando utilizar Store

Utilizar Zustand apenas quando o estado precisar ser compartilhado entre múltiplos componentes ou páginas.

Exemplos:

- sala atual
- participante atual
- idiomas selecionados
- status da chamada
- status da conexão Socket.IO
- permissões da sessão
- microfone ligado
- câmera ligada

---

# Quando NÃO utilizar Store

Não utilizar Zustand para:

- loading de botão
- abrir ou fechar modal local
- estado de formulário
- valor de input
- paginação local
- filtros locais
- blobs de áudio, streams, gravadores ou fila de upload
- estados usados apenas por um componente

Nestes casos utilizar:

- useState
- useReducer
- React Hook Form

---

# Dados da API

O TanStack Query é responsável pelo cache da API.

Nunca duplicar informações apenas para armazená-las na store.

Exemplo incorreto:

```ts
const room = useRoomStore();

room.setRoom(await api.getRoom());
```

Exemplo correto:

```ts
const { room } = useRoom();

const roomId = useRoomStore((state) => state.roomId);
```

A store deve guardar apenas informações realmente globais.

---

# Estrutura das Stores

Uma store deve possuir:

- estado
- actions
- reset

Exemplo:

```ts
type RoomStore = {
  roomId: string | null
  title: string |null

  setRoom: (...)

  clearRoom: ()
}
```

Evitar stores contendo dezenas de estados sem relação.

---

# Nome dos estados

Utilizar nomes claros.

Exemplo:

```ts
roomId;
participantId;
nickname;
isConnected;
targetLanguage;
```

Evitar:

```ts
data;
state;
value;
item;
object;
```

---

# Nome das Actions

Actions representam intenções.

Preferir:

```ts
setCurrentRoom();

clearCurrentRoom();

setParticipant();

clearParticipant();

setMicrophoneEnabled();

setTargetLanguage();

resetCallState();
```

Evitar:

```ts
setData();

update();

change();

save();

handle();
```

---

# Estrutura recomendada

```ts
import { create } from "zustand";

type RoomStore = {
  roomId: string | null;
  roomTitle: string | null;

  setCurrentRoom: (roomId: string, roomTitle: string) => void;

  clearCurrentRoom: () => void;
};

export const useRoomStore = create<RoomStore>((set) => ({
  roomId: null,
  roomTitle: null,

  setCurrentRoom: (roomId, roomTitle) =>
    set({
      roomId,
      roomTitle,
    }),

  clearCurrentRoom: () =>
    set({
      roomId: null,
      roomTitle: null,
    }),
}));
```

---

# Seleção de estados

Sempre selecionar apenas o estado necessário.

Correto:

```ts
const roomId = useRoomStore((state) => state.roomId);
```

Correto:

```ts
const isConnected = useSocketStore((state) => state.isConnected);
```

Evitar:

```ts
const store = useRoomStore();
```

Selecionar toda a store gera renderizações desnecessárias.

---

# Persistência

Persistência deve ser utilizada apenas quando realmente necessária.

Exemplos aceitáveis:

- preferência de tema
- idioma escolhido
- nickname

Exemplos não aceitáveis:

- senha da sala
- token temporário
- dados da chamada
- mensagens temporárias

Caso utilize persist:

```ts
persist(...)
```

Persistir apenas os campos necessários utilizando `partialize`.

---

# Reset

Toda store deve possuir método de reset quando fizer sentido.

Exemplo:

```ts
clearCurrentRoom();

clearParticipant();

resetCallState();

resetSocketState();
```

Ao sair da sala, todas as stores relacionadas devem ser limpas.

---

# Separação de responsabilidades

Store NÃO deve:

- fazer request HTTP
- abrir conexão socket
- validar formulário
- traduzir mensagens
- executar regra de negócio
- controlar interface

Store DEVE:

- armazenar estado compartilhado
- atualizar estado através de actions
- disponibilizar estado para a interface

---

# Boas práticas

- Criar stores pequenas.
- Separar stores por domínio.
- Utilizar nomes claros.
- Criar actions específicas.
- Criar métodos de reset.
- Evitar estados derivados quando puderem ser calculados.
- Evitar duplicação de dados.
- Manter stores simples.

---

# Checklist

Antes de finalizar uma store verificar:

- A store possui responsabilidade única.
- Está separada por domínio.
- Não faz chamadas HTTP.
- Não cria conexão Socket.IO.
- Não possui regra de negócio.
- Não duplica dados do TanStack Query.
- Possui actions com nomes claros.
- Possui método de reset.
- Seleciona apenas estados necessários.
- Não persiste dados sensíveis.
- Está localizada em `src/store`.
