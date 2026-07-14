# Forms Flow

Este arquivo define os padrões para criação, validação e manutenção de formulários no frontend do Dicere.

A pasta `src/core/forms` é responsável por formulários completos implementados como componentes React.

---

## Objetivo

Todo formulário reutilizável ou isolado da aplicação deve ser criado como um componente dentro de:

```text
src/core/forms
```

Exemplos:

```text
CreateRoomForm
JoinRoomForm
ParticipantSettingsForm
LanguageSettingsForm
```

Cada formulário deve concentrar:

- estrutura visual
- integração com React Hook Form
- consumo do schema Zod
- apresentação dos erros
- submissão dos dados
- composição dos componentes do Design System

---

## Escopo dos formulários

Só devem fazer parte dos formulários elementos diretamente relacionados a:

- campos
- validações
- estado do formulário
- mensagens de erro
- submissão
- ações de cancelar ou confirmar

Não incluir:

- imagens decorativas
- ilustrações
- banners
- conteúdo visual de apoio
- estrutura completa da página
- lógica de navegação não relacionada ao formulário
- conteúdo externo ao fluxo de preenchimento

Esses elementos devem permanecer no componente pai ou na feature.

---

## Responsabilidade da pasta

A pasta `src/core/forms` deve conter formulários completos.

Ela não deve conter componentes básicos como:

```text
InputText
Select
Checkbox
RadioGroup
Button
Textarea
```

Esses componentes devem permanecer em:

```text
src/core/components
```

Os formulários devem utilizar os componentes já existentes no Design System.

---

## Organização obrigatória

Cada formulário deve possuir sua própria pasta.

Os arquivos internos não devem repetir o nome da pasta.

Estrutura obrigatória:

```text
src/
└── core/
    └── forms/
        ├── forms-flow.md
        ├── create-room-form/
        │   ├── index.tsx
        │   └── schema.ts
        ├── join-room-form/
        │   ├── index.tsx
        │   └── schema.ts
        ├── participant-settings-form/
        │   ├── index.tsx
        │   └── schema.ts
        └── index.ts
```

Não utilizar:

```text
create-room-form/
├── create-room-form.tsx
├── create-room-schema.ts
└── index.ts
```

Utilizar:

```text
create-room-form/
├── index.tsx
└── schema.ts
```

---

## Responsabilidade dos arquivos

### `index.tsx`

Deve conter:

- componente React do formulário
- definição das props
- configuração do `useForm`
- integração com `zodResolver`
- consumo do schema
- função de submit
- integração com hooks
- renderização dos campos
- tratamento de erros do backend quando necessário

Não deve conter a definição do schema Zod.

---

### `schema.ts`

Deve conter exclusivamente:

- schema Zod
- tipo inferido pelo schema
- schemas auxiliares diretamente relacionados ao formulário, quando necessários

Exemplo:

```ts
import { z } from "zod";

export const joinRoomSchema = z.object({
  roomCode: z.string().trim().min(1, "Informe o código da sala"),

  name: z.string().trim().min(1, "Informe seu nome"),

  password: z.string().min(1, "Informe a senha da sala"),
});

export type JoinRoomSchemaType = z.infer<typeof joinRoomSchema>;
```

O arquivo `schema.ts` não deve conter:

- JSX
- hooks
- componentes React
- chamadas de API
- services
- mutations
- estados
- funções de navegação
- lógica visual

---

## Exportação central

A pasta `src/core/forms` deve possuir:

```text
src/core/forms/index.ts
```

Esse arquivo deve exportar os formulários.

Exemplo:

```ts
export { CreateRoomForm } from "./create-room-form";
export type { CreateRoomFormProps } from "./create-room-form";

export { JoinRoomForm } from "./join-room-form";
export type { JoinRoomFormProps } from "./join-room-form";

export { ParticipantSettingsForm } from "./participant-settings-form";
export type { ParticipantSettingsFormProps } from "./participant-settings-form";
```

Uso esperado:

```tsx
import { CreateRoomForm, JoinRoomForm } from "@/core/forms";
```

Evitar imports internos:

```tsx
import { JoinRoomForm } from "@/core/forms/join-room-form";
```

A não ser dentro da própria estrutura de `forms`.

---

## Regras gerais

- Todo formulário deve ser um componente React.
- Todo formulário deve possuir um schema Zod.
- O schema deve ficar obrigatoriamente em `schema.ts`.
- O schema não deve ser declarado dentro de `index.tsx`.
- Todo formulário deve utilizar React Hook Form.
- Toda integração deve utilizar `zodResolver`.
- Zod deve ser a fonte de verdade dos dados do formulário.
- O tipo deve ser inferido com `z.infer`.
- Não criar interfaces manuais duplicando o schema.
- Não utilizar `any`.
- Utilizar apenas TailwindCSS.
- Utilizar componentes existentes em `src/core/components`.
- Utilizar `Row` e `Column` para organização visual.
- Não chamar Axios diretamente.
- Não chamar services diretamente quando existir hook.
- Não utilizar Socket.IO diretamente.
- Não colocar lógica de infraestrutura no formulário.
- Não duplicar schemas.
- Não duplicar validações.
- Não criar arquivos internos com o mesmo nome da pasta.
- Não criar schemas dentro do componente.
- Não criar formulário completo fora de `src/core/forms` sem necessidade explícita.

---

## Padrão de nomes

A pasta deve utilizar kebab-case:

```text
create-room-form
join-room-form
participant-settings-form
```

O componente deve utilizar PascalCase:

```text
CreateRoomForm
JoinRoomForm
ParticipantSettingsForm
```

O schema deve utilizar camelCase:

```text
createRoomSchema
joinRoomSchema
participantSettingsSchema
```

O tipo inferido deve utilizar PascalCase e o sufixo `SchemaType`:

```text
CreateRoomSchemaType
JoinRoomSchemaType
ParticipantSettingsSchemaType
```

As props devem utilizar o nome do componente seguido de `Props`:

```text
CreateRoomFormProps
JoinRoomFormProps
ParticipantSettingsFormProps
```

---

## Padrão do schema

O schema deve seguir:

```ts
const {modulo}Schema = z.object(...)
```

Exemplo:

```ts
export const createRoomSchema = z.object({
  title: z.string().trim().min(1, "Informe o título da sala"),

  password: z.string().min(1, "Informe a senha da sala"),
});
```

O tipo deve seguir:

```ts
export type CreateRoomSchemaType = z.infer<typeof createRoomSchema>;
```

Não criar:

```ts
type CreateRoomFormData = {
  title: string;
  password: string;
};
```

quando o tipo já puder ser inferido pelo schema.

---

## Importação do schema

O `index.tsx` deve importar o schema e o tipo de `schema.ts`.

Exemplo:

```ts
import { createRoomSchema, type CreateRoomSchemaType } from "./schema";
```

---

## Configuração do formulário

Exemplo:

```ts
const {
  register,
  control,
  handleSubmit,
  setError,
  formState: { errors, isSubmitting, isValid },
} = useForm<CreateRoomSchemaType>({
  resolver: zodResolver(createRoomSchema),
  defaultValues: {
    title: "",
    password: "",
  },
});
```

O `useForm` deve sempre utilizar o tipo inferido pelo schema.

---

## Valores padrão

Os valores padrão devem ficar no `index.tsx`.

Exemplo:

```ts
defaultValues: {
  title: "",
  password: "",
}
```

Quando o formulário aceitar valores iniciais:

```ts
export type CreateRoomFormProps = {
  initialValues?: Partial<CreateRoomSchemaType>;
};
```

Uso:

```ts
defaultValues: {
  title: initialValues?.title ?? "",
  password: initialValues?.password ?? "",
}
```

---

## Props do formulário

As props devem permitir comunicação com o componente pai sem acoplar o formulário à página.

Exemplo:

```ts
export type CreateRoomFormProps = {
  onSuccess?: (room: Room) => void;
  onCancel?: () => void;
  initialValues?: Partial<CreateRoomSchemaType>;
  className?: string;
};
```

Preferir nomes com intenção clara:

```text
onSuccess
onCancel
initialValues
disabled
className
```

Evitar:

```text
data
callback
action
handler
values
```

quando esses nomes não deixarem clara a responsabilidade.

---

## Campos nativos

Quando o componente suportar `register`:

```tsx
<InputText {...register("name")} label="Nome" error={errors.name?.message} />
```

---

## Campos controlados

Quando o componente precisar de controle explícito:

```tsx
<Controller
  name="targetLanguage"
  control={control}
  render={({ field, fieldState }) => (
    <LanguageSelect {...field} error={fieldState.error?.message} />
  )}
/>
```

---

## Submit

A função de submit deve receber o tipo inferido:

```ts
function handleJoinRoom(data: JoinRoomSchemaType) {
  joinRoom(data);
}
```

Uso:

```tsx
<form onSubmit={handleSubmit(handleJoinRoom)}>
```

O botão principal deve possuir:

```tsx
<Button label="Entrar" type="submit" loading={isPending} disabled={isPending} />
```

---

## Integração com hooks

A submissão deve utilizar hooks do projeto.

Exemplo:

```ts
const { joinRoom, isPending } = useJoinRoom({
  onSuccess,
});
```

Não fazer:

```ts
await joinRoomService(...)
```

diretamente dentro do formulário quando existir hook para isso.

---

## Erros locais

Os erros do Zod devem ser exibidos nos respectivos campos.

Exemplo:

```tsx
<InputText
  {...register("password")}
  label="Senha"
  type="password"
  error={errors.password?.message}
/>
```

---

## Erros do backend

Erros específicos de campo devem utilizar `setError`.

Exemplo:

```ts
setError("password", {
  type: "server",
  message: "Senha incorreta",
});
```

Erros gerais devem seguir o padrão de feedback da aplicação.

---

## Regras do Zod

- Toda entrada obrigatória deve possuir mensagem de erro.
- As mensagens devem ser claras e em português.
- Utilizar `.trim()` quando espaços externos não forem relevantes.
- Não aplicar `.trim()` automaticamente em senha sem necessidade.
- Utilizar `.min()`, `.max()`, `.regex()`, `.email()` e outras validações conforme o contrato.
- Não implementar regras apenas no frontend.
- O backend continua sendo responsável pela validação final.
- Não transformar dados no componente quando o schema puder realizar a transformação.
- Não reutilizar schema de outro formulário apenas por conveniência quando os contratos forem diferentes.

---

## Exemplo de estrutura completa

```text
src/core/forms/join-room-form/
├── index.tsx
└── schema.ts
```

### `schema.ts`

```ts
import { z } from "zod";

export const joinRoomSchema = z.object({
  roomCode: z.string().trim().min(1, "Informe o código da sala"),

  name: z.string().trim().min(1, "Informe seu nome"),

  password: z.string().min(1, "Informe a senha da sala"),
});

export type JoinRoomSchemaType = z.infer<typeof joinRoomSchema>;
```

### `index.tsx`

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/core/components/button";
import { Column } from "@/core/components/column";
import { InputText } from "@/core/components/input-text";

import { joinRoomSchema, type JoinRoomSchemaType } from "./schema";

export type JoinRoomFormProps = {
  onSubmit: (data: JoinRoomSchemaType) => void;
  isPending?: boolean;
  className?: string;
};

export function JoinRoomForm({
  onSubmit,
  isPending = false,
  className,
}: JoinRoomFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JoinRoomSchemaType>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      roomCode: "",
      name: "",
      password: "",
    },
  });

  return (
    <form className={className} onSubmit={handleSubmit(onSubmit)}>
      <Column className="gap-4">
        <InputText
          {...register("roomCode")}
          label="Código da sala"
          error={errors.roomCode?.message}
          required
        />

        <InputText
          {...register("name")}
          label="Nome"
          error={errors.name?.message}
          required
        />

        <InputText
          {...register("password")}
          label="Senha"
          type="password"
          error={errors.password?.message}
          required
        />

        <Button
          label="Entrar na sala"
          type="submit"
          loading={isPending}
          disabled={isPending}
          width="full"
        />
      </Column>
    </form>
  );
}
```

---

## Checklist

Antes de finalizar um formulário, verificar:

- Está dentro de `src/core/forms`.
- Possui sua própria pasta.
- A pasta utiliza kebab-case.
- O componente está em `index.tsx`.
- O schema está em `schema.ts`.
- O schema não está dentro de `index.tsx`.
- Não existe arquivo repetindo o nome da pasta.
- Existe um schema Zod.
- O schema segue `{modulo}Schema`.
- O tipo segue `{Modulo}SchemaType`.
- O tipo utiliza `z.infer`.
- O `useForm` utiliza o tipo inferido.
- O `useForm` utiliza `zodResolver`.
- Não existe interface duplicando o schema.
- Existem valores padrão quando necessário.
- Os erros estão sendo exibidos.
- O submit está tipado.
- Não existe `any`.
- Não existem chamadas Axios diretas.
- Não existem chamadas diretas a services quando existe hook.
- Utiliza componentes do Design System.
- Utiliza apenas TailwindCSS.
- Trata loading e submit duplicado.
- Trata erros do backend quando necessário.
