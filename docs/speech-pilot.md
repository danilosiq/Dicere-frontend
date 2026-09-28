# Homologação de voz por sala no domínio público

O rollout global continua desligado. `NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS`
seleciona até dez UUIDs de salas exclusivos de homologação, separados por vírgula.
Lista vazia, inválida ou excessiva não ativa nenhuma sala. O workflow recebe a
lista da variável de repositório `SPEECH_SERVER_CANARY_ROOM_IDS` no build Docker.
Não colocar senhas, tokens ou áudio nesta variável: UUIDs ficam no bundle público.

Nesta release, a flag antiga `NEXT_PUBLIC_SPEECH_SERVER_ENABLED=true` não libera
outras salas; o build Docker também rejeita a tentativa global. O backend aplica
a mesma restrição, independente do cliente. Os gates de qualidade, fala longa e
capacidade ainda reprovam a promoção geral. Reabrir a promoção exige uma nova
release revisada com evidências, contratos/testes atualizados e CI/CD, não uma
mudança de variável. Isso não altera o fluxo legado fora do piloto.

A seleção muda somente a interface/motor da sala correspondente. O backend
continua exigindo senha/associação válida, sala ativa, piloto autorizado e
readiness do STT. Alterar o cliente não concede acesso ao serviço interno.
Outras salas permanecem no caminho anterior; não executar os dois motores juntos.

Antes de capturar áudio, o participante precisa aceitar o aviso existente em
cada sala. O candidato reconhece somente PT-BR; idiomas de destino continuam
independentes. Outras origens mostram a limitação sem transcrever como português.
Danilo autorizou a primeira entrega com origem PT-BR em 24/09/2026. Isso não
aprova automaticamente semântica, disponibilidade, capacidade ou os 4 segundos.

## Sequência operacional

1. Criar sala exclusiva com senha e prazo de validade normal; guardar credenciais
   fora de Git/CI/Notion. Não alterar a expiração para prolongar testes.
2. Habilitar somente esse UUID no helper de piloto do backend, mantendo a flag
   global desligada. O helper pode reconectar sockets ao recriar a API.
3. Configurar a lista do frontend e publicar pelo CI/CD. Variáveis `NEXT_PUBLIC_`
   são fixadas no build: reiniciar o contêiner não atualiza a lista.
4. Confirmar o digest e testar em `https://dicere.cloud`, sem proxy de bundle
   local. Conferir aviso/consentimento e que uma sala fora da lista segue legada.
5. Registrar navegador, rede, falas e destinatários reais. Danilo dispensou sua
   chamada manual em 25/09/2026; não registrar teste Chrome/Windows como executado
   por causa dessa dispensa ou de um ensaio automatizado em macOS.
6. Encerrar a sala e remover o piloto do backend ao terminar. Remover também a
   variável do frontend e reconstruir. Clientes já abertos podem manter o bundle
   antigo, mas a autorização do backend deve impedir novas sessões.

Para rollback, o pipeline preserva a imagem anterior. Voltar ao caminho local
não resolve por si só sua precisão. Não liberar o motor globalmente para fazer
um teste individual nem marcar critérios pendentes como concluídos.

## Compatibilidade obrigatória antes da publicação

O workflow executa `node scripts/speech-compatibility.mjs https://api.dicere.cloud`
antes de publicar a imagem e novamente antes de atualizar o contêiner. Exige
`x-speech-release` compatível no OpenAPI da API implantada: protocolo v1, PT-BR,
PCM16 mono 16 kHz e captura durante processamento. Backend antigo, erro HTTP/rede,
contrato ausente/incompatível, resposta acima de 1 MiB ou prazo de 5 s excedido
bloqueiam a etapa. Não são impressos corpo, credenciais ou detalhes de exceções.

Esse contrato não é readiness do modelo nem aprovação de qualidade/capacidade.
O CI backend instala primeiro a API e depois o STT interno; o helper de piloto
e o `speech_ready` verificam saúde/autorização antes da captura real. Os workflows
não constituem uma transação distribuída; um rollback posterior da API exige
respeitar a ordem do protocolo, mesmo após um check frontend aprovado.

Rollback planejado: frontend sem piloto primeiro, remoção da lista na API e só
depois retorno da API/STT. Bundles já abertos podem precisar de recarga. Em
emergência, retirar o piloto na API interrompe novas sessões imediatamente após
aplicar/reiniciar, mas pode reconectar sockets e mostrar falha nos clientes piloto.
Rollback não apaga dados e não transforma o reconhecedor anterior em modelo aprovado.
Antes de voltar a uma versão anterior ao bloqueio, confirmar também que as flags
globais antigas estão explicitamente desligadas: versões antigas ainda as respeitam.
