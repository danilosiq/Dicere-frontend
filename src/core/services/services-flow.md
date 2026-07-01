# Services Flow

Este documento define os padrões para implementação dos services no frontend do Dicere.

O objetivo é centralizar toda comunicação externa da aplicação, mantendo componentes e hooks desacoplados da infraestrutura.

Toda implementação de service deve seguir este documento.

---

# Objetivo

Os services são responsáveis por toda comunicação externa da aplicação.

Eles podem realizar:

- chamadas HTTP
- comunicação Socket.IO
- integração com APIs externas

Os services **não** devem conter lógica de interface ou regras de negócio.

---

# Regras gerais

- Toda chamada HTTP deve passar por um service.
- Utilizar Axios para comunicação HTTP.
- Não realizar requests diretamente em componentes.
- Não realizar requests diretamente em hooks.
- Não utilizar `fetch`.
- Cada domínio deve possuir seu próprio service.
- Services devem retornar apenas `response.data`.
- Não tratar loading dentro do service.
- Não exibir toast dentro do service.
- Não utilizar Zustand dentro do service.
- Não acessar componentes React dentro do service.

---

# Organização

Os services devem ficar em:

```text
src/
└── services/
    ├── api.ts
    ├── room-service.ts
    ├── participant-service.ts
    ├── chat-service.ts
    ├── translation-service.ts
    └── ...
```

Cada domínio possui seu próprio service.

---

# Cliente Axios

Toda comunicação HTTP deve utilizar um client centralizado.

Exemplo:

```ts
import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});
```

Todos os services devem importar este client.

---

# Estrutura dos services

Cada função representa uma ação da API.

Exemplo:

```ts
export async function getRoom(params: GetRoomParams) {
  const response = await api.get(`/rooms/${params.roomId}`);

  return response.data;
}
```

Outro exemplo:

```ts
export async function createRoom(body: CreateRoomBody) {
  const response = await api.post("/rooms", body);

  return response.data;
}
```

---

# Passagem de parâmetros

Utilizar objetos como parâmetro da função.

Correto:

```ts
type GetRoomParams = {
  roomId: string;
};

export async function getRoom(params: GetRoomParams) {
  const response = await api.get(`/rooms/${params.roomId}`);

  return response.data;
}
```

Evitar:

```ts
export async function getRoom(roomId: string);
```

Objetos facilitam evolução futura da API.

---

# Query Params

Quando utilizar query params:

```ts
type ListMessagesParams = {
  roomId: string;
  page: number;
};

export async function listMessages(params: ListMessagesParams) {
  const response = await api.get(`/rooms/${params.roomId}/messages`, {
    params: {
      page: params.page,
    },
  });

  return response.data;
}
```

---

# Body

Quando existir payload:

```ts
type CreateRoomBody = {
  title: string;
  password: string;
};

export async function createRoom(body: CreateRoomBody) {
  const response = await api.post("/rooms", body);

  return response.data;
}
```

---

# Update

```ts
type UpdateParticipantParams = {
  participantId: string;
  nickname: string;
};

export async function updateParticipant(params: UpdateParticipantParams) {
  const response = await api.patch(`/participants/${params.participantId}`, {
    nickname: params.nickname,
  });

  return response.data;
}
```

---

# Delete

```ts
type DeleteRoomParams = {
  roomId: string;
};

export async function deleteRoom(params: DeleteRoomParams) {
  const response = await api.delete(`/rooms/${params.roomId}`);

  return response.data;
}
```

---

# Tratamento de erro

Os services **não** devem capturar erros apenas para repassá-los.

Evitar:

```ts
try {
    ...
} catch (error) {
    throw error
}
```

Permitir que o erro seja tratado pelo TanStack Query.

---

# Retorno

Sempre retornar:

```ts
return response.data;
```

Evitar:

```ts
return response;
```

---

# Socket Service

A conexão Socket.IO também deve ser centralizada em service.

Exemplo:

```ts
import { io } from "socket.io-client";

export const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
  autoConnect: false,
  transports: ["websocket"],
});
```

Os hooks deverão consumir este service.

---

# Responsabilidades

Services DEVEM:

- comunicar com APIs
- comunicar com Socket.IO
- retornar dados
- encapsular infraestrutura

Services NÃO DEVEM:

- renderizar interface
- controlar loading
- utilizar Zustand
- utilizar TanStack Query
- validar formulários
- exibir notificações
- implementar regras de negócio

---

# Checklist

Antes de finalizar um service verificar:

- Está localizado em `src/services`.
- Utiliza o client Axios centralizado.
- Retorna apenas `response.data`.
- Não utiliza `fetch`.
- Não utiliza Zustand.
- Não utiliza TanStack Query.
- Não possui lógica de negócio.
- Não possui lógica de interface.
- Não possui `try/catch` desnecessário.
- Recebe parâmetros através de objetos.
- Está organizado por domínio.
