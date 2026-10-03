# Presença e retomada da sala

F5, fechamento da página e saída da rota encerram o socket da sala. Uma
desconexão invalida `isJoined`, cancela a reconexão automática do transporte e
preserva somente a identidade retomável: a Home solicita a senha novamente,
sem persistir credenciais. Nenhum socket novo é tratado como participante ativo
antes de `room_joined`.

O botão Sair também encerra o socket, mesmo se câmera/microfone falharam antes
de `join-call`. A saída explícita apaga a identidade local e não reabre o drawer
da sala. Um timeout de entrada fecha o transporte para cancelar a reserva tardia.
O hook de conexão não encerra a sala no replay de efeitos do Strict Mode nem
permite que a limpeza de uma tela antiga feche um socket recém-conectado.

No backend, entrada em sala/chamada e desconexão são coordenadas por socket.
A limpeza aguarda reservas em andamento, preserva o cadastro na desconexão e
remove presença e sinalização. A consulta de presença viva não impede a limpeza
de uma chamada encerrada; o script Redis não apaga negociação de outra geração.
Continua havendo limite atômico de duas conexões e bloqueio de identidade ativa
em outro socket. Perda abrupta de rede depende do heartbeat, não é instantânea.

## Regressão automática

`node test/speech-browser/room-reconnection.mjs` usa navegador e API reais,
cria/encerra uma sala própria e testa saída com mídia negada, três F5 com a mesma
identidade, perda de transporte, voltar na SPA, fechamento do contexto e
substituto com o mesmo nome, além de capacidade/identidade ativa protegidas.
Com `UI_TEST_MEDIA=allowed`, usa mídia sintética do Chromium e exige `call-joined`
em cada entrada/retomada. Não envia áudio para STT/DeepL nem mede qualidade de voz
ou mídia entre dois pares. Front/API são configuráveis com `UI_TEST_URL` e
`UI_TEST_API`; os padrões são os domínios de produção.

O teste público não roda automaticamente em cada push: ele cria recursos reais.
Testes de hook, rota, serviço e Socket.IO isolado rodam em CI. Backend inclui
Redis real em CI e limpeza apenas de chaves exclusivas do ensaio; nunca usa
FLUSHDB. A suíte backend exige Redis acessível em `REDIS_URL`.
