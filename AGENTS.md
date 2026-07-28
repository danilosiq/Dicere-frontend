# AGENTS.md

Este arquivo registra os combinados do projeto para reutilização nos próximos chats.

---

## Objetivo

Este repositório é o frontend do Dicere, responsável pela interface de criação, acesso e uso das salas de comunicação em tempo real entre dois participantes.

O frontend deve permitir criação de sala, entrada via URL e senha, escolha de nickname, configuração de idiomas, chamada em tempo real e chat com tradução sob demanda.

O foco é um MVP funcional, priorizando clareza de uso, organização por feature, baixo acoplamento e fidelidade às regras de negócio definidas.

---

## Princípios arquiteturais

- Utilizar organização modular por feature
- Separar lógica de UI, estado, serviços e tipos
- Não misturar regras de interface com comunicação de API
- Não chamar Axios diretamente dentro de componentes
- Não conectar Socket.IO diretamente dentro de componentes
- Centralizar chamadas HTTP em `services`
- Centralizar comunicação Socket.IO em `services` ou hooks específicos
- Hooks devem concentrar lógica reutilizável
- Store global deve ser usada apenas para estados realmente compartilhados
- Componentes próprios, globais e reutilizáveis devem ficar em `src/core/components`
- Componentes específicos devem ficar dentro da própria feature
- `src/components/ui` é reservado exclusivamente aos componentes nativos instalados pelo shadCn
- Wrappers, adaptações e derivações de componentes shadCn devem ficar em `src/core/components`
- Reutilizar componentes existentes antes de criar novos
- Manter a arquitetura definida no Notion

---

## Regras e restrições gerais

- Não alterar estrutura de pastas, contratos ou arquivos existentes sem solicitação
- Não criar código fora do escopo solicitado
- Não implementar funcionalidades não pedidas explicitamente
- Em caso de dúvida, perguntar antes de implementar
- Não introduzir novas dependências externas sem necessidade explícita
- Não duplicar lógica existente
- Não criar código morto ou incompleto
- Não deixar `console.log` em código final
- Não deixar estados, imports ou componentes sem uso
- Não quebrar compatibilidade com APIs existentes
- Toda entrada de usuário deve possuir validação
- Toda chamada assíncrona deve tratar loading e erro
- Toda feature deve considerar estados vazios, erro e carregamento
- Toda tela deve respeitar light mode e dark mode
- Toda implementação visual deve seguir as cores, fontes e padrões definidos no setup
- Todo o uso de datas e formatações, deverá ser usado `date-fns`

---

## Regras de negócio

- O usuário pode criar uma sala
- A sala deve possuir título e senha
- Acesso à sala exige URL, senha e nickname
- Nickname deve ser único dentro da sala
- Sala suporta no máximo 2 participantes simultâneos
- Participantes são temporários e vinculados à sala
- O criador da sala é o administrador
- O administrador pode encerrar a sala
- O administrador pode remover o outro participante
- Cada participante deve selecionar:
  - idioma que fala
  - idioma em que deseja receber tradução
- A sala deve possuir chat textual
- Mensagens do chat podem ser traduzidas sob demanda
- A tradução do chat deve respeitar o idioma de destino do usuário solicitante
- Sala pode ser encerrada manualmente, por expiração ou por inatividade parcial

---

## Stack

- NextJs
- TypeScript
- TailwindCSS
- Axios
- Tanstack Query
- Socket.IO Client
- Lucide Icons
- shadCn
- react-speech-recognition
- Zustand
- date-fns

---

## Estrutura

```text
/page
  /api
  /rotas...
  index.tsx
  layout.tsx

/src
  /components
    /ui              # somente componentes nativos do shadCn
  /core
    /components      # componentes próprios globais e reutilizáveis
    /features
    /hooks
    /services
    /@types
    /utils
    /styles
    /store
```
