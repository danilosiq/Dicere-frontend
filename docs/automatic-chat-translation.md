# Tradução automática do chat

Todas as mensagens exibidas, incluindo enviadas, recebidas e histórico, são traduzidas automaticamente para o idioma de destino selecionado pelo participante. O texto original permanece preservado no contrato da API e no histórico.

- Durante a consulta, o balão exibe `Traduzindo...`.
- Após sucesso, exibe a tradução e oferece `Ver original`.
- `Ver tradução` reutiliza a tradução em memória sem nova consulta.
- Em caso de falha, exibe o original, informa o erro e permite tentar novamente. Não repete automaticamente consultas que falharam.
- Sem idioma de destino válido, mantém o original e orienta a seleção do idioma.
- A fila automática permite até três consultas simultâneas. Novas mensagens e mensagens carregadas por paginação entram na fila.
- O cache é separado por mensagem e idioma, dentro da sala. Trocar de sala ou desmontar cancela as consultas em andamento.

O frontend reutiliza o endpoint de tradução existente, sem mudanças no backend. Os testes do hook e do chat cobrem tradução automática, alternância, falhas, concorrência e troca de idioma.
