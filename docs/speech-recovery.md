# Recuperação da captura de voz

O motor servidor possui recuperação limitada para indisponibilidade, saturação,
timeout, perda do ACK e desconexão. A camada `RecoveringSpeechEngine` cria uma
sessão de captura nova após 500, 1000 e 2000 ms, no máximo três vezes. Não armazena
nem reenvia o trecho interrompido: ele pode ter sido processado antes de perder
o ACK. A interface informa a reconexão e desabilita tentativas manuais concorrentes.

Cada tentativa exige novamente prontidão do serviço e usa o ciclo normal de
permissão/captura. Permissão negada, idioma não suportado, acesso negado,
resposta inválida e limite de fala longa não causam repetição automática.
Após esgotar as tentativas, permanece disponível uma ação manual explícita.
O orçamento só é renovado depois de 30 segundos contínuos no estado de escuta;
sucessos breves de prontidão não podem criar um ciclo infinito de falhas.

Mute, saída, troca de sala/idioma, desmontagem, `pagehide` e segundo plano
cancelam timers e captura. Retornar à aba não reativa o microfone automaticamente.
Callbacks antigos são invalidados por geração. Nenhuma trilha da chamada WebRTC
é gerenciada por essa camada, somente a captura separada do reconhecimento.

Diagnósticos mantêm código, idioma e número de tentativa, sem áudio/texto. A
recuperação não transforma o trecho perdido em sucesso nem garante os 4 segundos.
Não aumenta os prazos da API/modelo, não habilita o rollout global e não resolve
o limite atual de 12 segundos de fala contínua. Testes simulados cobrem o ciclo;
validação de rede, carga e áudio reais permanece independente.

## Mute no reconhecimento local

O fluxo local distingue silenciar de cancelar a sessão. Ao mutar, a captura
separada do reconhecimento libera suas tracks, conexões e AudioContext
imediatamente. PCM posterior é ignorado. Somente segmentos já fechados pelo
segmentador, em inferência ou na fila limitada existente, podem terminar e
entregar texto uma vez, na ordem original. Áudio parcial ainda sem endpoint
não é transcrito nem enviado. A trilha WebRTC continua sob controle da chamada.

A drenagem tem prazo máximo de 30 segundos, sem ampliar o timeout de inferência.
Mute/unmute rápidos não iniciam dois modelos em paralelo: a próxima sessão
aguarda a drenagem anterior e não inicia se tiver sido cancelada nesse intervalo.
Saída, troca de sala/idioma, retry e desmontagem cancelam worker, fila e callbacks
antigos. Silenciar durante preparação/permissão não inicia captura posteriormente.

Testes determinísticos cobrem esse ciclo com respostas de worker controladas.
O teste Chromium usa recursos de mídia/worklet reais e microfone sintético, mas
não executa Whisper, API ou DeepL. Ele valida lifecycle, não qualidade acústica,
tradução, microfone físico, Windows ou o limite fim a fim de quatro segundos.

## Legenda recebida fora de ordem

O histórico mantém a sequência de fala, mas cada recebimento/revisão aceita
ganha um ordinal local separado (`receivedOrder`), sem confiar no valor remoto.
Duplicatas e revisões descartadas não promovem a legenda. A retenção guarda os
100 recebimentos mais recentes e depois ordena pela sequência da fala; isso
impede que um trecho antigo recuperado seja descartado imediatamente.

A janela existente de três legendas seleciona as três chegadas/atualizações
mais recentes e as apresenta na ordem de fala. Após 2/3/4 e recuperação de 1,
mostra 1/3/4, anuncia 1 e rola o contêiner até sua linha. Não muda o visual,
não rola a página e não transforma essa janela em arquivo permanente.
Dados legados sem ordinal continuam usando a sequência como referência.

Testes de composição socket/hook/React e geometria real de Chromium verificam
apresentação, anúncio e retenção. Não comprovam precisão de transcrição/tradução,
rede real ou SLA de voz; esses critérios permanecem independentes.
