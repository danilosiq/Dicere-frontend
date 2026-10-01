# Teste real de voz no navegador

## Fronteiras da captura local

O caminho local reagrupa PCM em janelas canônicas de 2048 amostras antes de
decidir atividade e silêncio. Fragmentação dos pacotes não muda as amostras
entregues ao modelo. Os testes de fronteira cobrem 16/44,1/48 kHz, diferentes
alinhamentos, pausas internas, repetição, PCM inválido e múltiplos endpoints em
um pacote. A fila continua limitada a três trechos além do processamento ativo.

O teto nominal de 8 s é avaliado no fim de uma janela: o limite efetivo é
`ceil(8 × sampleRate / 2048) × 2048` amostras (8,064 s em 16 kHz), como já ocorria
em produção. Uma hipótese com janela de energia de 16 ms e outra com corte em
8,000 s exatos foram rejeitadas após regressões no modelo real. Não confundir
essa duração máxima do áudio com o SLA de 4 s após o fim da fala.

Cliques não contam como janelas inteiras de atividade: o mínimo usa energia
em janelas móveis de 16 ms, sem mudar a regra de endpoint. Isso não é um detector
semântico de voz, nem garante ausência de alucinação em ruído. O modelo Tiny,
os idiomas liberados e o rollout do STT interno não mudam nesta correção.

## Smoke de lifecycle em CI

`npm run test:speech-microphone` executa Chromium/AudioWorklet reais com o
dispositivo sintético do navegador, sem API, modelo, tradução ou salas. Verifica
duas capturas independentes: frames PCM recebidos, parada sem frames tardios,
tracks de STT encerradas e stream separada da chamada preservada em stop/restart.
O teste transpila o módulo real de microfone e serve o worklet real em loopback.
Fechamento do browser tem prazo e falha se exigir encerramento forçado. Roda
automaticamente no CI antes do build. Não valida acústica, conexão WebRTC entre
pares, Chrome/Windows, qualidade de transcrição ou SLA fim a fim.

`npm run test:local-speech-lifecycle` exercita o motor local e o segmentador
reais com AudioContext/AudioWorklet no Chromium, áudio sintético e worker de
inferência controlado. Verifica liberação imediata da captura no mute, entrega
única dos segmentos já fechados, cancelamento durante drenagem e preservação
da stream separada da chamada. Também roda no CI, sem carregar Whisper,
contatar API/DeepL ou criar sala. Resposta controlada não comprova qualidade
do reconhecedor; a matriz real abaixo permanece independente.

## Visibilidade de legendas recuperadas

`npm run test:subtitle-visibility` transpila o helper real de apresentação e
exercita sua seleção e rolagem com layout real no Chromium, em loopback. Após
2/3/4 e chegada tardia de 1, a janela mostra 1/3/4 em ordem de fala; a primeira
linha do trecho recuperado fica dentro do viewport, sem rolar a página. IDs com
aspas também são exercitados. O fechamento do navegador é limitado e não aceita
encerramento forçado. Roda no CI antes do build, sem API, áudio ou modelo.

Vitest cobre separadamente a composição socket/hook/React, ordem local de
recebimento, retenção de 100 trechos recentes, duplicatas/revisões, anúncio
acessível e métricas. A janela visual continua limitada a três trechos; não é
arquivo permanente de conversa nem comprovação de qualidade ou latência de voz.

## Ensaio fim a fim

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
Antes de cada fala, verifica que o relógio de áudio da fonte sintética avança e
que sua track permanece ativa. Computador em suspensão/dark wake pode executar
JavaScript sem avançar áudio; nesse caso registra
`TEST_AUDIO_CLOCK_NOT_ADVANCING`, sem interpretar a ausência de áudio como
resultado do reconhecedor. Isso não valida o microfone físico nem protege contra
suspensão posterior: toda falha e medição incompleta continua no relatório.
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
Antes de fechar os contextos, o executor encerra explicitamente todos os
AudioContexts sintéticos que criou (inclusive os substituídos por retry),
interrompe tracks/fontes, desconecta nós e o observador de legendas. Fontes
terminadas são desconectadas imediatamente. Falha nessa limpeza reprova o
executor, mas não impede a tentativa de fechar contexto e navegador. Essa
limpeza é exclusiva do teste, não altera o microfone da aplicação pública.
As streams nativas de câmera/áudio obtidas pelos clientes WebRTC do teste
também são rastreadas e encerradas, inclusive se chegarem após iniciar a limpeza.
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

## Interpretar a matriz sem esconder falhas

`evaluate-report.mjs` separa transcrição/latência, execução técnica e aceite
humano. Saída 124 (timeout), encerramento forçado, erro do navegador ou limpeza
incompleta reprovam a execução, mesmo se a legenda estiver correta. A revisão
humana do fim da fala e das traduções permanece um gate independente.

Ao agregar tentativas, use `summarizeAttempts` com todos os relatórios e códigos
de saída reais. Não substitua uma falha pela repetição bem-sucedida do idioma.
Informe tentativas aprovadas/reprovadas e idiomas com pelo menos um sucesso
separadamente. O teste mantém `accepted: false` porque um único áudio não cobre
toda a matriz de homologação da sprint.

Depois do cleanup, um watchdog não bloqueante dá 5 s para o processo Node sair.
Se algum recurso o mantiver vivo, salva `EXECUTOR_SHUTDOWN_TIMEOUT` e reprova
a execução antes de encerrar. Registra somente tipos/contagens de recursos,
sem endereços ou conteúdo. Esse limite impede travar o controlador do piloto;
não transforma um encerramento problemático em sucesso.
