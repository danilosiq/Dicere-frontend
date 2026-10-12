# Recuperação da captura de voz

O motor servidor possui recuperação automática para indisponibilidade, saturação,
timeout, perda do ACK, interrupção de captura e desconexão. A camada
`RecoveringSpeechEngine` cria uma sessão nova com backoff de 500ms até 30s, sem
esgotar depois de três falhas. Não armazena
nem reenvia o trecho interrompido: ele pode ter sido processado antes de perder
o ACK. A interface informa a reconexão e desabilita tentativas manuais concorrentes.

Cada tentativa exige novamente prontidão do serviço e usa o ciclo normal de
permissão/captura. Permissão negada, idioma não suportado, acesso negado,
resposta inválida e áudio inválido não causam repetição automática.
O contador só é renovado depois de 30 segundos contínuos no estado de escuta;
sucessos breves de prontidão não provocam tentativas rápidas indefinidamente.
Offline suspende as tentativas; retorno da rede e confirmação `room_joined`
permitem recuperação. Não há reenvio cego de áudio.

Mute, saída, troca de sala/idioma, desmontagem e `pagehide` cancelam timers e
captura. `visibilitychange=hidden` não é erro e não encerra o reconhecimento.
Retornar à aba ou um evento `resume` pode antecipar a recuperação pendente, mas
nunca liga um microfone que o usuário silenciou. O consentimento informa que a
captura habilitada continua em segundo plano quando o navegador permitir.
Callbacks antigos são invalidados por geração. Nenhuma trilha da chamada WebRTC
é gerenciada por essa camada, somente a captura separada do reconhecimento.

Diagnósticos mantêm código, idioma e número de tentativa, sem áudio/texto. A
recuperação não transforma o trecho perdido em sucesso nem garante os 4 segundos.
Não aumenta os prazos da API/modelo nem habilita o rollout global. A captura
servidor divide fala contínua em janelas de até 6 s sem parar o microfone;
esse teto é por requisição, não por conversa. Testes simulados cobrem o ciclo;
validação de rede, carga e áudio reais permanece independente.

## Fala contínua no motor servidor

Frases curtas mantêm o endpoint por silêncio de 768 ms. Após 2 s de captura,
uma pausa acústica de 200 ms pode fechar a janela antecipadamente. Todos os
idiomas usam teto de 6 s. A política reduz o trabalho por janela sem ampliar
timeout. Ao atingir esse teto,
a janela fecha e a captura seguinte continua automaticamente, inclusive
dentro do mesmo pacote PCM. A janela de atividade é zerada nesse rollover para
evitar abrir uma sessão vazia com a energia residual da janela anterior. O
pré-roll preserva o início seguinte; nenhum áudio é sobreposto ou deduplicado.

O cliente existente envia a próxima captura durante inferência, serializa as
finalizações e conserva os limites de backpressure, cancelamento e timeout.
Falhas de rede/processamento continuam explícitas, sem reenvio cego. Não há
limite de 12 s para a duração total da fala; cada envio respeita 384000 bytes.

Testes determinísticos verificam captura de 13/31/65 s, integridade e ordem do
PCM, múltiplas fronteiras, silêncio após a fronteira exata e pacotes variados.
PCM íntegro não significa reconhecimento perfeito: sem pausa, uma fronteira
forçada pode separar uma palavra. O modelo não recebe contexto acústico da
janela anterior; qualidade e SLA precisam de evidência real independente.

## Tradução progressiva e readmissão da sala

O back entrega cada frase curta confirmada assim que termina sua tradução, sem
esperar as traduções seguintes. Não são prévias corrigíveis. Contexto textual
fonte limitado e efêmero ajuda a manter coesão entre janelas; não recupera palavras
mal reconhecidas. Uma falha posterior não remove frases já entregues.

Reconectar o socket não readmite o participante. `RoomConnectionRecovery`
repete a admissão da mesma identidade, com backoff, antes de retomar a chamada.
Senha só permanece em memória durante a visita: nunca entra em sessionStorage,
localStorage ou logs; saída remove a referência. Recarregar a página continua
exigindo admissão com senha. Perda de rede descarta o transporte antigo; falhas
permanentes removem listeners e bloqueiam novas tentativas. Estado de mídia
local e preferências de mute/câmera sobrevivem à queda, sem forçar unmute.
Storage bloqueado não impede o estado em memória de funcionar.

O teste Chromium de recuperação usa mídia/AudioWorklet reais, microfone
sintético e `context.setOffline`, com transporte controlado. Verifica retomada,
tracks encerradas e ausência de replay/erro artificial em segundo plano. A
mudança de visibilidade é sintética: não substitui validação de microfone físico,
Windows ou decisão do navegador/SO de congelar/descartar uma aba. JavaScript não
pode garantir captura durante hibernação ou encerramento do processo.

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
