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

Testes verificam PCM idêntico para diferentes tamanhos de pacote e posições de
início, início baixo preservado no preroll, pausas, ausência de duplicação,
limites, silêncio e descarte atômico de entrada inválida. Não incorporam áudio
nem texto esperado do usuário ao reconhecedor. Repetições/deslocamentos de uma
gravação não contam como novos exemplos humanos nem aprovam precisão geral.

A variante experimental com decisões em blocos de 256 amostras foi rejeitada
após regressão de precisão. A versão deslizante remove a dependência da fase do
bloco, mas a liberação pública continua condicionada aos gates da sprint.
