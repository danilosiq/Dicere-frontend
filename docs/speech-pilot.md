# Homologação de voz por sala no domínio público

O rollout global continua desligado. `NEXT_PUBLIC_SPEECH_SERVER_CANARY_ROOM_IDS`
seleciona até dez UUIDs de salas exclusivos de homologação, separados por vírgula.
Lista vazia, inválida ou excessiva não ativa nenhuma sala. O workflow recebe a
lista da variável de repositório `SPEECH_SERVER_CANARY_ROOM_IDS` no build Docker.
Não colocar senhas, tokens ou áudio nesta variável: UUIDs ficam no bundle público.

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
5. Registrar navegador/Windows, rede, falas e destinatários reais. Uma execução
   automatizada em macOS não substitui a chamada humana de aceite.
6. Encerrar a sala e remover o piloto do backend ao terminar. Remover também a
   variável do frontend e reconstruir. Clientes já abertos podem manter o bundle
   antigo, mas a autorização do backend deve impedir novas sessões.

Para rollback, o pipeline preserva a imagem anterior. Voltar ao caminho local
não resolve por si só sua precisão. Não liberar o motor globalmente para fazer
um teste individual nem marcar critérios pendentes como concluídos.
