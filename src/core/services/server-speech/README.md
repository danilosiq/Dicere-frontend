# Segmentação candidata por amostras

O início/fim da fala não depende do tamanho dos pacotes de captura. Uma janela
deslizante de energia de 256 amostras (16 ms a 16 kHz), atualizada a cada amostra,
detecta atividade com o limiar RMS candidato de 0,008. Não é um VAD semântico:
ruído também pode ativá-la; calibração no corpus humano continua necessária.

`PcmPreroll` guarda as últimas 4096 amostras (256 ms) antes da detecção. Ao iniciar,
o histórico é enviado uma única vez, em ordem, seguido das amostras atuais.
`PcmFrameBuffer` agrupa a saída em até 2048 amostras por pacote e descarrega o
restante antes de finalizar. A precisão da análise não multiplica as mensagens
de rede. Histórico/janela/pacote têm memória fixa; não acumulam a conversa.

O fim exige 12288 amostras sem atividade (768 ms), mantendo a tolerância efetiva
do candidato anterior com pacotes de 2048. Na transição para silêncio digital,
a janela pode acrescentar até 16 ms; a entrega do AudioWorklet acrescenta até
128 ms de quantização. Portanto, não confundir 768 ms com latência de endpoint
garantida: ela deve ser medida no navegador e incluída nos 4000 ms totais.
Silêncio e pausas não usam timers. O limite de 12 s continua retornando erro
explícito; fala maior, contexto e janelas sobrepostas ainda não estão resolvidos.

## Transporte com captura antecipada

O cliente não bloqueia o envio da próxima fala esperando a transcrição/tradução
da anterior. Mantém no máximo uma finalização pendente e uma captura no servidor;
as finalizações continuam sequenciais, sem retransmissão ou entrega fora de ordem.
Caso uma nova fala termine antes do ACK anterior, sua finalização aguarda esse ACK.
A fila local permanece limitada a 64000 bytes e 32 comandos: uma conexão lenta
continua produzindo erro explícito, não acúmulo ilimitado de áudio.

Mute/saída/falha enviam `speech_cancel {}` para cancelar captura e processamento.
Respostas tardias não reiniciam o fluxo. É necessário publicar primeiro o backend
que admite uma captura durante processamento; em rollback, reverter primeiro
este cliente ou desligar a flag. O protocolo v1 e o cliente sequencial anterior
continuam compatíveis com o backend novo. Não é inferência incremental e não
representa aprovação do SLA de 4 s nem do teste de capacidade de duas pessoas.

Testes verificam PCM idêntico para diferentes tamanhos de pacote e posições de
início, início baixo preservado no preroll, pausas, ausência de duplicação,
limites, silêncio e descarte atômico de entrada inválida. Não incorporam áudio
nem texto esperado do usuário ao reconhecedor. Repetições/deslocamentos de uma
gravação não contam como novos exemplos humanos nem aprovam precisão geral.

A variante experimental com decisões em blocos de 256 amostras foi rejeitada
após regressão de precisão. A versão deslizante remove a dependência da fase do
bloco, mas a liberação pública continua condicionada aos gates da sprint.
