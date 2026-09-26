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
