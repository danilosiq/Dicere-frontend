# shadCn Flow

Este documento define onde os componentes shadCn e suas derivações devem ser
armazenados no frontend do Dicere.

---

# Componentes nativos do shadCn

Todo componente instalado diretamente pelo shadCn deve permanecer em:

```text
src/components/ui
```

Esse diretório é reservado ao código-base gerado ou instalado pelo shadCn.
Componentes desse diretório podem ser atualizados novamente pela ferramenta e
não devem concentrar regras ou identidade visual específica do Dicere.

Exemplos:

```text
src/components/ui/button.tsx
src/components/ui/drawer.tsx
```

---

# Componentes derivados

Qualquer wrapper, adaptação, composição ou derivação de um componente shadCn é
um componente próprio do Dicere.

Quando reutilizável em vários lugares, deve ficar em:

```text
src/core/components
```

Exemplos:

```text
src/core/components/button.tsx
src/core/components/drawer.tsx
```

O componente derivado deve importar o componente nativo por meio de
`@/components/ui/...` e expor somente a API necessária para a aplicação.

---

# Componentes específicos de feature

Componentes usados somente por uma feature devem permanecer dentro da própria
feature, mesmo quando utilizarem ou derivarem componentes shadCn.

```text
src/core/features/room/components
```

Não promover um componente específico para `src/core/components` antes que ele
seja realmente compartilhado.

---

# Restrições

- Não criar componentes próprios diretamente em `src/components`.
- Não colocar wrappers ou adaptações em `src/components/ui`.
- Não adicionar regras de negócio aos componentes nativos do shadCn.
- Não editar componentes nativos para atender uma única feature.
- Reutilizar o componente nativo ou derivado existente antes de criar outro.

---

# Checklist

- É código instalado pelo shadCn: `src/components/ui`.
- É componente próprio e global: `src/core/components`.
- É componente específico: diretório `components` da feature.
- Derivações importam o componente nativo de `@/components/ui`.
