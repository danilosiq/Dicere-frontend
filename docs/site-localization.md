# Idiomas da interface

A interface oferece Português, Inglês, Espanhol e Chinês simplificado. O idioma
do site é independente do idioma falado/digitado e do destino das traduções.

## Preferência

- A primeira visita escolhe o primeiro idioma suportado em `navigator.languages`.
- Variantes regionais são normalizadas; `zh-TW` também usa chinês simplificado.
- Sem idioma suportado, o fallback é Português brasileiro.
- O seletor com bandeiras fica ao lado da data/hora no cabeçalho. Na chamada,
  também está disponível na barra de ferramentas.
- A escolha manual é salva em `dicere-site-locale` no localStorage e sincronizada
  entre abas. Storage bloqueado não impede a troca em memória.
- A página mantém renderização inicial determinística em português; após a
  hidratação aplica a preferência e atualiza `html.lang` e a descrição da página.
- Data e hora usam `date-fns` com o locale da interface e o relógio local.

## Organização

`src/core/i18n` contém o provider, detecção e dicionários separados por idioma e
por responsabilidade (interface/feedback). Os componentes usam `useSiteLanguage`.
As chaves são as mensagens-fonte em português, verificadas pelo TypeScript.
Interpolação usa valores de texto e não HTML.

Botões, labels, placeholders, tutorial, consentimento, tooltips, feedback e nomes
acessíveis são localizados, incluindo a página 404 e o erro de renderização de
página. Títulos de sala, nomes de participantes, mensagens e
legendas recebidas nunca passam pelo tradutor da interface. Os detalhes
desconhecidos de erro do servidor/navegador usam feedback genérico localizado;
as mensagens conhecidas e os limites/tentativas preservam suas instruções.
Nenhuma API de tradução é chamada para a interface e nenhuma dependência foi adicionada.
Formulários usam validação Zod com `noValidate` para que os avisos nativos do
navegador não ignorem o idioma escolhido manualmente no site.
As ilustrações com frases usam versões separadas em Inglês, Espanhol e Chinês
simplificado, selecionadas pelo mesmo locale da interface. A ilustração principal
e a saudação do tutorial mudam junto com o seletor; personagens, paleta, composição
e transparência seguem as referências originais. Os PNGs de Português e as
ilustrações sem frases permanecem intactos. Os assets e o processo de edição estão
documentados em `docs/illustration-localization.md`.
As versões novas são servidas como WebP lossless estático, sem depender da
otimização em tempo real na VPS.

## Validação

- `npm test -- src/core/i18n`: paridade dos dicionários/tokens, preferências,
  storage bloqueado, hidratação, formulários, controles de chamada e isolamento
  do reconhecedor de voz ao trocar somente o idioma do site.
- `UI_TEST_URL=http://localhost:3106 node test/speech-browser/site-localization.mjs`:
  quatro idiomas, 320/1440px, light/dark, flags, validação real do formulário,
  troca/persistência/reload, escolha e carregamento das artes localizadas e ausência
  de erros de página. Não cria salas nem
  envia áudio/texto às APIs de produção.
