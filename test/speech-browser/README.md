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

## Piloto com backend real de produção

É possível servir o bundle candidato local sob a origem pública somente nos
dois navegadores de teste com `SPEECH_TEST_FRONTEND_PROXY=http://localhost:3104`.
O relatório declara esse modo explicitamente: o bundle não é o frontend público
liberado aos usuários. Nenhuma rota da API, STT ou DeepL é interceptada/simulada.
Buildar o candidato com as URLs reais da API e a flag de voz habilitada.

`SPEECH_TEST_EXISTING_ROOM_FILE` aceita um JSON privado de sala criada exclusivamente
para teste, com `ownedTestRoom: true`, `roomId`, `code`, `title`, `adminParticipantId`
e `password`. O executor entra pela UI e fecha apenas essa sala ao terminar.
A liberação da sala no backend e sua desativação devem ser feitas pelo operador,
inclusive quando o navegador falhar; o executor não altera configuração de servidor.

O modo padrão cobre duas sessões e quatro falas sequenciais com retry
manual entre tentativas. `SPEECH_TEST_SIMULTANEOUS=true` executa dois pares de
falas concorrentes, registra o desvio entre os inícios e a sobreposição mínima
considerando a incerteza dos relógios. Ausência de sobreposição reprova o ensaio.
As duas tentativas terminam antes do cleanup, mesmo quando uma falha.
O relatório é salvo antes de encerrar os recursos. A sala exclusiva é fechada
antes do navegador. O executor inicia um BrowserServer restrito a loopback e
mantém a referência ao processo que criou; não procura nem encerra Chrome do
usuário. Após fechar contextos/conexão, tenta encerrar esse processo com prazo
de 10 s e, se necessário, força somente seu encerramento, também com prazo.
O relatório distingue `browserConnectionClosed`, `browserClosed` e
`browserForcedStop`. Falha no fechamento da conexão ou processo ainda vivo
reprova o executor; um encerramento forçado bem-sucedido fica explícito, não é
prova de que o travamento original do Chrome tenha sido corrigido.
Repetir a mesma gravação em dois participantes testa concorrência, não amplia
o corpus humano. Silêncio, troca de sala/idioma, reconexão, mute e carga
sustentada precisam ampliar a matriz; não marcar a história 10 concluída só por
este executor passar.

## Diagnóstico privado do áudio transportado

`SPEECH_TEST_CAPTURE_TRANSPORT=true` habilita, somente neste executor, a captura
do PCM enviado por WebSocket nas sessões do teste. Por padrão ela está desligada;
não adiciona gravação de áudio à aplicação. Use apenas com a gravação consentida
definida no caso privado. O observador verifica ids, ordem, tamanho e conclusão
do trecho; não salva sessões incompletas ou misturadas a outro evento binário.
Limites: 8 sessões por socket, 384000 bytes por sessão, 16000 bytes por bloco.

Arquivos `transport-<id>.pcm` ficam no diretório privado com permissão 0600 e sem
sobrescrever gravações existentes. Relatório registra caminho, hash e tamanho,
sem imprimir conteúdo. Falha de escrita reprova o teste, preservando o cleanup.
Não enviar esses arquivos/relatórios ao GitHub, CI ou Notion. Servem para comparar
a saída da captura/segmentação com o áudio original e repetir exatamente a
entrada do modelo, distinguindo erro de STT de erro posterior de tradução.
