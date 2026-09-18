# Teste real de voz no navegador

Este executor abre duas sessões reais do Dicere, cria uma sala exclusiva,
seleciona IT/ES como destinos, aceita o aviso e injeta PCM somente na entrada do
microfone de STT. AudioWorklet, segmentação, Socket.IO, backend, modelo e DeepL
são os reais da aplicação. Não é simulação de STT/tradução nem medição acústica
do microfone físico.

O ambiente deve estar preparado antes da medição: front com a flag de voz do
servidor, API compatível, PostgreSQL/Redis isolados, STT aquecido e chave DeepL
válida. Não executar compilação/testes paralelos e depois apresentar o resultado
como desempenho em repouso. Resultados sob carga também devem ser preservados.

Execute `npm run test:speech-browser -- /caminho/privado/caso.json`.
Playwright é dependência de desenvolvimento. Use um Chrome instalado via
`SPEECH_TEST_CHROME_PATH`, ou instale o navegador do Playwright no ambiente de teste.
Endereços padrão: frontend localhost:3104, API localhost:3344; podem ser alterados
com `SPEECH_TEST_FRONTEND_URL` e `SPEECH_TEST_API_URL`. URLs remotas requerem
`SPEECH_TEST_ALLOW_REMOTE=true`, pois o executor cria/fecha uma sala real.

O JSON privado precisa dos campos: `audioPcmPath` (PCM16 LE mono 16 kHz),
`reference`, `consented: true`, `referenceConfirmed: true`,
`earliestSpeechEndSample`, `speechEndReviewed`, `modelRevision`,
`frontendRevision`, `backendRevision` e `environment` (hardware/rede/carga).
O fim da fala deve ser anotado/revisado no áudio humano, não confundido com o fim
do arquivo. Em dúvida, use o início do intervalo possível para um limite superior
conservador e mantenha `speechEndReviewed: false` até revisão.

O controlador calibra os dois relógios e soma a incerteza da captura/calibração.
A observação da legenda ocorre após dois frames de renderização e usa o id do
segmento. São preservados todos os resultados, inclusive timeout, falta de
legenda e valores acima de 4 s. Repetições não contam como áudios humanos distintos.
Há teste unitário da conta e da comparação literal (não converte “tá” em “está”).

Relatórios completos contêm texto privado e ficam somente em
`.speech-quality-private`, com permissão 0600, fora de Git e Docker. Console
contém apenas métricas técnicas. Não publicar estes relatórios como artefatos
de CI. O script nunca declara aceite: revisão semântica, corpus com 20 áudios,
Windows, simultaneidade/carga e produção continuam gates independentes.

Esta primeira versão cobre duas sessões e quatro falas sequenciais com retry
manual entre tentativas. Silêncio, troca de sala/idioma, reconexão, mute e carga
sustentada precisam ampliar a matriz; não marcar a história 10 concluída só por
este executor passar.
