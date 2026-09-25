# Idioma falado e idioma de leitura

## Primeira entrega aprovada em 24/09/2026

Danilo autorizou voz em português brasileiro primeiro. O reconhecimento candidato
é TAGARELA/Parakeet PT-BR no servidor; somente o locale `pt-BR` é aceito.
Não há alternativa aprovada para as outras origens nesta entrega. A interface
mantém a escolha, mas mostra a limitação antes de iniciar a captura/transmissão.
Não se deve converter outra origem silenciosamente para português.

O seletor **Idioma falado** das legendas controla a origem local. O idioma
escolhido na entrada da sala controla a tradução recebida pelo participante.
Mudar o idioma falado não altera a preferência de leitura do outro participante.

## Inventário da interface

| Opções expostas                                                     | Como origem no candidato        | Como destino                        |
| ------------------------------------------------------------------- | ------------------------------- | ----------------------------------- |
| PT-BR                                                               | TAGARELA, locale pt-BR          | Fluxo existente de tradução/leitura |
| PT, PT-PT                                                           | Não suportadas; aviso explícito | Fluxo existente de tradução/leitura |
| EN, EN-GB, EN-US                                                    | Não suportadas; aviso explícito | Fluxo existente de tradução/leitura |
| BG, CS, DA, DE, EL, ES, ET, FI, FR, HU, ID, IT                      | Não suportadas; aviso explícito | Fluxo existente de tradução/leitura |
| JA, KO, LT, LV, NB, NL, PL, RO, RU, SK, SL, SV, TR, UK, ZH, ZH-HANS | Não suportadas; aviso explícito | Fluxo existente de tradução/leitura |

São 34 opções, incluindo variantes. Fora das salas piloto, o fluxo local Whisper
continua inalterado; isso não é uma validação de sua precisão. O backend também
recusa locales diferentes de pt-BR, independentemente do comportamento do cliente.

## Evidências e limites

- Testes do motor percorrem as 33 opções não suportadas e verificam ausência de
  captura e de chamada de readiness, além do erro explícito.
- Os testes de roteamento garantem exclusividade entre motor local e servidor.
- Ensaios de produção anteriores com origem PT-BR e destinos IT/ES reproduziram
  a frase completa. A matriz de destinos não comprova reconhecimento dessas
  línguas como origem nem qualidade semântica universal.
- Os testes reais e a revisão humana de tradução são registrados no Notion e
  nos relatórios privados; não incluir gravações, textos privados ou senhas aqui.
- Esta decisão de idioma não dispensa os critérios de latência, corpus variado,
  capacidade, recuperação, privacidade e Chrome/Windows antes da liberação geral.
