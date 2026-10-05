# Localização das ilustrações

Edição feita com a ferramenta integrada de imagens, a partir dos PNGs originais.
Os originais foram preservados. As seis versões ficam em
`src/core/assets/images/localized/`: `dicere-photo-1-{en,es,zh-CN}.png` e
`salui-guy-{en,es,zh-CN}.png`.
As versões servidas ao navegador são WebP lossless irmãos dos PNGs, gerados uma
vez com Sharp (já fornecido pelo Next). Preservam pixels visíveis e transparência,
com arquivos menores; os PNGs continuam como fontes de edição.

Em produção, a requisição de otimização WebP de uma arte ficou pendente por mais
de 30 segundos, mesmo com o PNG respondendo HTTP 200 rapidamente e contêineres
sem OOM/restart. Também reproduzido via HTTP interno do contêiner com Accept
`image/webp`. As seis versões localizadas usam `unoptimized` no componente Next
Image: entrega estática do WebP pronto, com hash/cache immutable, sem codificação
em tempo real na VPS. As imagens originais não foram alteradas.

## Prompts finais

Caso de uso: `text-localization`. Editar apenas o texto do PNG de referência.
Preservar personagens, identidade, poses, roupas, cenário, composição, proporção,
paleta, tipografia, ângulo dos balões, sombras e fundo transparente real. Não
adicionar elementos, recortar ou manter texto português nas versões traduzidas.

Para a ilustração principal, substituir o parágrafo na mesma coluna à esquerda,
sem sobrepor o rosto; os balões roxo/verde e a ação de tradução usam os textos abaixo.
Ícones e bandeira brasileira permanecem porque ilustram uma conversa de exemplo.

### Inglês

Parágrafo: "Hi! How are you? How was your day? Oh, I see. My day was wonderful!
I had a great lunch and ate my favorite food! I wanted to learn more about Dicere!
What a cool app!"

Balão roxo: "Hi! What a lovely afternoon!". Balão verde: "Hi! What's up!".
Ação: "Translate". Saudação 3D do tutorial: "Hi!".

### Espanhol

Parágrafo: "¡Hola! ¿Cómo estás? ¿Cómo estuvo tu día? Ah, entiendo. ¡Mi día fue
maravilloso! Almorcé muy bien y comí mi comida favorita. ¡Quería saber más sobre
Dicere! ¡Qué aplicación tan genial!"

Balão roxo: "¡Hola! ¡Qué tarde tan bonita!". Balão verde: "¡Hola! ¿Qué tal?".
Ação: "Traducir". Saudação 3D do tutorial: "¡Hola!".

### Chinês simplificado

Parágrafo: "你好！你好吗？今天过得怎么样？哦，我明白了。我的一天过得很棒！午餐很丰盛，还吃了我最喜欢的食物！我想了解更多关于 Dicere 的信息！真是个不错的应用！"

Balão roxo: "你好！多么美好的下午！". Balão verde: "嗨！最近怎么样？".
Ação: "翻译". Saudação 3D do tutorial: "你好！".

Para o tutorial, substituir apenas "Saluí" pela saudação correspondente, mantendo
letras 3D arredondadas em teal, posição, volume visual e material da referência.

## Validação

Revisão visual dos PNGs antes da integração; testes de seleção de asset nos quatro
locales; regressão real em Chromium que verifica a URL da arte e `image.decode()`
antes e depois da escolha manual/reload. A verificação automática do arquivo não
substitui a revisão visual de texto, transparência e estilo.
O teste espera o arquivo final em `currentSrc`, `complete` e `naturalWidth` antes
de decodificá-lo, evitando corrida entre o primeiro frame PT-BR e o locale salvo.
Também exige URL estática para as novas artes, prevenindo o retorno ao otimizador.
