# Hooks Flow

Este documento define os padrões para criação e utilização de hooks no frontend do Dicere.

O objetivo é manter os componentes limpos, centralizar lógica reutilizável e padronizar chamadas HTTP, mutations, queries e eventos WebSocket.

Toda implementação de hook deve seguir este documento.

---

# Objetivo

Hooks devem concentrar lógica reutilizável da aplicação.

Eles podem ser usados para:

- buscar dados
- executar mutations
- encapsular regras de UI reutilizáveis
- consumir services
- ouvir eventos Socket.IO
- emitir eventos Socket.IO
- integrar estado global com componentes

Hooks **não** devem conter JSX.

---

# Regras gerais

- Todo hook deve começar com `use`.
- Cada hook deve possuir responsabilidade única.
- Hooks HTTP devem utilizar TanStack Query.
- Hooks HTTP devem consumir `services`.
- Hooks não devem chamar Axios diretamente.
- Hooks não devem criar conexão Socket.IO diretamente.
- Hooks WebSocket devem consumir o service centralizado de socket.
- Hooks devem retornar dados e estados necessários para a UI.
- Não duplicar hooks existentes.
- Não criar hooks genéricos sem necessidade real.
- Não colocar regra visual complexa dentro de componentes quando puder ser extraída para hook.

---

# Organização

Hooks globais:

```text
src/
└── hooks/
```

Hooks específicos de uma feature:

```text
src/
└── features/
    └── room/
        └── hooks/
```

Regra:

- usado por uma feature: fica dentro da feature
- usado por várias features: fica em `src/hooks`

---

# Hooks de Query

Usar `useQuery` para buscar dados.

Retorno esperado:

- data
- isLoading
- isFetching
- isError
- error
- refetch

Exemplo:

```ts
export function useRoom(roomId: string) {
  const query = useQuery({
    queryKey: roomQueryKeys.detail(roomId),
    queryFn: () => roomService.findById(roomId),
    enabled: !!roomId,
  });

  return {
    room: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
```

---

# Hooks de Mutation

Usar `useMutation` para criar, atualizar, remover ou executar ações.

Retorno esperado:

- função de ação com nome claro
- data
- isPending
- isSuccess
- isError
- error
- reset

Exemplo:

```ts
export function useCreateRoom() {
  const mutation = useMutation({
    mutationFn: roomService.create,
  });

  return {
    createRoom: mutation.mutate,
    createRoomAsync: mutation.mutateAsync,
    room: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

---

# Callbacks externos

Hooks de mutation podem receber callbacks externos quando necessário.

Exemplo:

```ts
type UseCreateRoomOptions = {
  onSuccess?: (data: CreateRoomResponse) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
};

export function useCreateRoom(options?: UseCreateRoomOptions) {
  const mutation = useMutation({
    mutationFn: roomService.create,
    onSuccess: options?.onSuccess,
    onError: options?.onError,
    onSettled: options?.onSettled,
  });

  return {
    createRoom: mutation.mutate,
    createRoomAsync: mutation.mutateAsync,
    room: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

---

# Query Keys

Query keys devem ser centralizadas por domínio.

Exemplo:

```ts
export const roomQueryKeys = {
  all: ["rooms"] as const,
  detail: (roomId: string) => ["rooms", roomId] as const,
};
```

Uso:

```ts
useQuery({
  queryKey: roomQueryKeys.detail(roomId),
  queryFn: () => roomService.findById(roomId),
});
```

Evitar:

```ts
useQuery({
  queryKey: ["room", roomId],
  queryFn: () => roomService.findById(roomId),
});
```

---

# Invalidação de cache

Mutations devem invalidar queries relacionadas quando necessário.

Exemplo:

```ts
export function useCreateRoom() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: roomService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: roomQueryKeys.all,
      });
    },
  });

  return {
    createRoom: mutation.mutate,
    createRoomAsync: mutation.mutateAsync,
    room: mutation.data,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
```

---

# Hooks WebSocket

Hooks WebSocket devem encapsular eventos Socket.IO sem expor detalhes de conexão para os componentes.

---

# Regras para WebSocket

- Utilizar `socket.io-client`.
- A conexão deve ser centralizada em service.
- Não usar `io()` dentro de hooks de feature.
- Não usar `io()` dentro de componentes.
- Não criar múltiplas conexões.
- Registrar listeners dentro de `useEffect`.
- Remover listeners no cleanup.
- Separar eventos por domínio.
- Não deixar listeners duplicados.
- Não emitir eventos sem payload válido.
- Não depender de estado obsoleto dentro dos listeners.

---

# Socket Service

A conexão deve ficar centralizada em service.

Exemplo:

```ts
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }

  return socket;
}

export function connectSocket() {
  const socket = getSocket();

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket?.connected) {
    socket.disconnect();
  }
}
```

---

# Hook de conexão

```ts
import { useEffect } from "react";
import { connectSocket, getSocket } from "@/services/socket";
import { useSocketStore } from "@/store/socket-store";

export function useSocketConnection() {
  const setSocketConnected = useSocketStore(
    (state) => state.setSocketConnected,
  );

  useEffect(() => {
    const socket = connectSocket();

    function handleConnect() {
      setSocketConnected(true);
    }

    function handleDisconnect() {
      setSocketConnected(false);
    }

    setSocketConnected(socket.connected);

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [setSocketConnected]);

  return {
    socket: getSocket(),
  };
}
```

---

# Hook genérico de evento

```ts
import { useEffect } from "react";
import { getSocket } from "@/services/socket";

export function useSocketEvent<TPayload>(
  event: string,
  handler: (payload: TPayload) => void,
) {
  useEffect(() => {
    const socket = getSocket();

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}
```

---

# Hook de emissão

```ts
import { getSocket } from "@/services/socket";

export function useSocketEmit() {
  function emit<TPayload>(event: string, payload: TPayload) {
    const socket = getSocket();

    if (!socket.connected) {
      return;
    }

    socket.emit(event, payload);
  }

  return {
    emit,
  };
}
```

---

# Hooks WebSocket por domínio

Criar hooks específicos por domínio quando o evento pertencer a uma feature.

Exemplo de envio de mensagem:

```ts
export function useSendChatMessage() {
  const { emit } = useSocketEmit();

  function sendMessage(payload: SendMessagePayload) {
    emit("chat:send-message", payload);
  }

  return {
    sendMessage,
  };
}
```

Exemplo de recebimento de mensagem:

```ts
export function useMessageReceived(
  onMessageReceived: (message: Message) => void,
) {
  useSocketEvent<Message>("chat:message-received", onMessageReceived);
}
```

---

# Retorno dos hooks

Hooks devem retornar apenas o necessário para a UI.

Exemplo correto:

```ts
return {
  createRoom,
  room,
  isPending,
  isSuccess,
  isError,
  error,
};
```

Evitar retornar o objeto inteiro do TanStack Query sem necessidade:

```ts
return mutation;
```

---

# Tratamento de erro

Hooks devem expor o erro para a UI.

O componente decide como exibir o erro.

```ts
return {
  error: mutation.error,
  isError: mutation.isError,
};
```

Não exibir toast obrigatório dentro do hook, exceto se for um padrão definido para aquela feature.

---

# Checklist

Antes de finalizar um hook, verificar:

- O hook começa com `use`.
- O hook possui responsabilidade única.
- Hooks HTTP usam TanStack Query.
- Hooks HTTP consomem services.
- Hooks não usam Axios diretamente.
- Query keys estão centralizadas.
- Mutations retornam `data`, `isPending`, `isSuccess`, `isError`, `error` e `reset`.
- Queries retornam `data`, `isLoading`, `isFetching`, `isError`, `error` e `refetch`.
- Callbacks externos existem quando necessário.
- Mutations invalidam cache quando necessário.
- Hooks Socket.IO usam service centralizado.
- Hooks Socket.IO removem listeners no cleanup.
- Hooks Socket.IO não criam conexões duplicadas.
- Componentes não usam Axios diretamente.
- Componentes não usam `io()` diretamente.
