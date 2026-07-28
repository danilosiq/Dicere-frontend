# Components Flow

Este documento define os padrões para criação e utilização de componentes no frontend do Dicere.

O objetivo é manter componentes reutilizáveis, consistentes, simples e alinhados com a arquitetura do projeto.

Toda implementação de componente deve seguir este documento.

---

# Objetivo

Componentes são responsáveis pela interface da aplicação.

Eles devem ser pequenos, reutilizáveis quando possível e não devem concentrar regras de negócio, chamadas HTTP ou comunicação Socket.IO diretamente.

---

# Regras gerais

- Utilizar apenas TailwindCSS para estilização.
- Evitar utilizar tags HTML diretamente.
- Não utilizar `div` diretamente em features.
- Utilizar componentes estruturais como `Row` e `Column`.
- Não utilizar CSS Modules.
- Não utilizar styled-components.
- Não utilizar arquivos `.css` ou `.scss` sem solicitação explícita.
- Não utilizar estilos inline sem necessidade explícita.
- Não chamar Axios dentro de componentes.
- Não usar `io()` dentro de componentes.
- Não acessar services diretamente em componentes quando existir hook para isso.
- Não colocar regra de negócio dentro de componentes.
- Reutilizar componentes existentes antes de criar novos.

---

# Organização

Componentes globais:

```text
src/
└── core/
    └── components/
        ├── button.tsx
        ├── drawer.tsx
        ├── layout.tsx
        └── ...
```

Todo componente próprio usado em vários lugares deve ficar em
`src/core/components`, inclusive wrappers, adaptações e derivações de
componentes shadCn.

O diretório `src/components/ui` é exclusivo para componentes nativos
instalados pelo shadCn. Não adicionar regras de negócio, wrappers ou
customizações do Dicere nesse diretório.

Componentes específicos de feature:

```text
src/
└── core/
    └── features/
        └── room/
            └── components/
```

---

# Componentes globais

Componentes globais devem ser reutilizáveis em 3 ou mais features.

Exemplos:

- Button
- Input
- Select
- Modal
- Badge
- Avatar
- Row
- Column
- Card
- Text
- Title

Não criar componente global para uso único.

---

# Componentes de feature

Componentes usados por apenas uma feature devem ficar dentro da própria feature.

Exemplo:

```text
src/
└── core/
    └── features/
        └── room/
            ├── components/
            │   ├── CreateRoomForm.tsx
            │   └── RoomAccessCard.tsx
            └── index.tsx
```

---

# Row e Column

Para estrutura visual, utilizar `Row` e `Column`.

Exemplo:

```tsx
<Column className="gap-4">
  <Title>Criar sala</Title>

  <Row className="items-center justify-between">
    <Text>Participantes</Text>
    <Badge>Máximo 2</Badge>
  </Row>
</Column>
```

Evitar:

```tsx
<div className="flex flex-col gap-4">
  <h1>Criar sala</h1>

  <div className="flex items-center justify-between">
    <p>Participantes</p>
    <span>Máximo 2</span>
  </div>
</div>
```

---

# TailwindCSS

Toda estilização deve ser feita com TailwindCSS.

Exemplo:

```tsx
<Button className="bg-primary-green w-full rounded-xl text-white">
  Criar sala
</Button>
```

Evitar:

```tsx
<Button style={{ backgroundColor: "#296B66" }}>Criar sala</Button>
```

---

# Props

Props devem ser tipadas.

Exemplo:

```tsx
type RoomCardProps = {
  title: string;
  participantsCount: number;
  onEnter: () => void;
};

export function RoomCard({ title, participantsCount, onEnter }: RoomCardProps) {
  return (
    <Column className="gap-3 rounded-xl border border-gray-200 p-4">
      <Title>{title}</Title>
      <Text>{participantsCount}/2 participantes</Text>
      <Button onClick={onEnter}>Entrar</Button>
    </Column>
  );
}
```

---

# Responsabilidade única

Um componente deve fazer apenas uma coisa.

Se o componente estiver grande demais, separar em componentes menores.

Exemplo:

```text
CreateRoomForm
RoomPasswordInput
LanguageSelect
SubmitButton
```

---

# Componentes e hooks

Componentes podem consumir hooks.

Exemplo:

```tsx
export function CreateRoomForm() {
  const { createRoom, isPending } = useCreateRoom();

  return (
    <Column className="gap-4">
      ...
      <Button disabled={isPending}>Criar sala</Button>
    </Column>
  );
}
```

Componentes não devem consumir services diretamente.

Evitar:

```tsx
await roomService.create(...)
```

---

# Estados obrigatórios

Quando aplicável, componentes devem tratar:

- loading
- erro
- estado vazio
- sucesso
- disabled

Exemplo:

```tsx
<Button disabled={isPending}>{isPending ? "Criando..." : "Criar sala"}</Button>
```

---

# Acessibilidade

Componentes devem possuir o mínimo necessário de acessibilidade.

- Inputs devem ter label.
- Botões devem ter texto claro.
- Estados disabled devem ser visíveis.
- Modais devem ter título.
- Ícones sozinhos devem possuir descrição acessível quando necessário.

---

# Nomes

Utilizar nomes claros e específicos.

Exemplos bons:

```text
CreateRoomForm
RoomAccessCard
LanguageSelect
ChatMessageItem
ParticipantBadge
```

Evitar:

```text
CardComponent
FormComponent
Item
Box
Container
```

---

# Checklist

Antes de finalizar um componente verificar:

- Usa TailwindCSS.
- Evita tags HTML diretas.
- Não usa `div` diretamente em feature.
- Usa `Row` e `Column` para layout.
- Props estão tipadas.
- Não chama Axios.
- Não usa Socket.IO diretamente.
- Não contém regra de negócio.
- Está no lugar correto: global ou feature.
- Componentes próprios globais estão em `src/core/components`.
- Apenas componentes nativos do shadCn estão em `src/components/ui`.
- Reutiliza componentes existentes.
- Trata loading, erro ou disabled quando necessário.
- Não possui `console.log`.
- Não possui imports sem uso.
- Não possui estilos inline desnecessários.
