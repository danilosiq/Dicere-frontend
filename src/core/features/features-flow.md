# Frontend Feature Guidelines

Este arquivo define os padrões para criação e manutenção de features no frontend do Dicere.

---

## Objetivo

Garantir que todas as features sigam o mesmo padrão visual, estrutural e arquitetural.

Toda nova feature deve respeitar a arquitetura definida no `AGENTS.md` e os padrões deste documento.

---

## Regras gerais

- Evitar utilizar tags HTML diretamente em componentes de feature
- Não utilizar `div` diretamente
- Utilizar componentes estruturais como `Row` e `Column`
- utilizar `Sreen` no final de cada feature
- Utilizar apenas TailwindCSS para estilização
- Não criar arquivos `.css`, `.scss` ou estilos inline sem solicitação explícita
- Não utilizar styled-components, CSS Modules ou outras soluções de estilo
- Não adicionar bibliotecas visuais novas sem aprovação
- Reutilizar componentes globais existentes antes de criar componentes novos
- Componentes específicos da feature devem ficar dentro da própria feature
- Manter componentes pequenos e com responsabilidade única

---

## Layout

- Usar `Row` para alinhamentos horizontais
- Usar `Column` para alinhamentos verticais
- Evitar repetição de classes Tailwind muito longas
- Quando um layout se repetir, extrair para componente
- Não misturar estrutura de layout com lógica de negócio

Exemplo esperado:

```tsx
<Column className="gap-4">
  <Title>Criar sala</Title>

  <Row className="items-center justify-between">
    <Text>Participantes</Text>
    <Badge>2 máximo</Badge>
  </Row>
</Column>
```
