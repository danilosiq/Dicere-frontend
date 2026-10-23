# Ruídos reconhecidos como fala — 2026-10-22

## Causa e alcance

O fluxo local é `AudioWorklet → LocalSpeechSegmenter → worker Whisper Tiny →
onText → tradução`. O segmentador usava RMS >= 0,008 e pelo menos 250 ms de
atividade acumulada. Energia acústica não identifica linguagem: palmas repetidas,
estalos e ruídos de boca podiam abrir segmentos válidos. O worker transcrevia
todo segmento admitido e entregava qualquer texto não vazio. O tradutor recebia
uma transcrição já incorreta.

O início do vídeo fornecido mostra legendas incluindo “Obrigado” e “Tchau”
durante a sequência de testes. O arquivo do OBS é uma mistura de áudio de saída,
não o PCM original do microfone. A reprodução local confirmou a categoria do
bug; não reproduziu literalmente todas as palavras exibidas na gravação.

## Correção

O worker agora carrega Silero VAD v5.1.2 junto do reconhecedor. Antes de chamar
Whisper, exige 250 ms consecutivos de probabilidade de fala >= 0,5. Cliques
separados não acumulam evidência de voz. O modelo e seus estados são isolados
por worker; a recorrência é reiniciada em cada segmento. A captura, o pré-roll,
a duração máxima e o contrato de mensagens foram preservados.

Uma saída composta inteiramente de anotações (`[MÚSICA]`, `(música)`, efeitos ou
notas musicais) também não segue para tradução. Não existe lista de palavras
proibidas: “Obrigado”, “Tchau”, “Oi” e “Não” continuam válidos quando há fala.
O detector não é uma garantia contra toda vocalização ou ruído possível.

## Reprodução com o vídeo

Foram decodificados somente os primeiros 60 segundos, localmente, em mono
Float32 a 16 kHz. O mesmo segmentador de produção recebeu pacotes de 128
amostras. O mesmo Whisper Tiny q8, revisão
`ff4177021cc41f7db950912b73ea4fdf7d01d8e7`, usou português, transcrição e
amostragem desativada. Não houve envio de áudio a terceiros.

| Trecho (s)    | Resultado anterior | Resultado corrigido                |
| ------------- | ------------------ | ---------------------------------- |
| 23,168–24,960 | `[MÚSICA]`         | VAD rejeita; Whisper não é chamado |
| 25,088–27,648 | `(música)`         | VAD rejeita; Whisper não é chamado |
| 36,736–38,656 | `[MÚSICA]`         | VAD rejeita; Whisper não é chamado |
| 38,912–43,776 | `[MÚSICA]`         | VAD rejeita; Whisper não é chamado |
| 44,672–48,384 | `[sobido]`         | Anotação não segue para tradução   |
| 51,200–52,736 | `(música)`         | Anotação não segue para tradução   |
| 53,248–54,656 | `Bap!`             | VAD rejeita; Whisper não é chamado |
| 56,960–59,520 | `[MÚSICA]`         | VAD rejeita; Whisper não é chamado |

Os outros dois segmentos admitidos no primeiro minuto mantiveram a transcrição
anterior. Isso comprova ausência de regressão nesses dois exemplos, não precisão
linguística perfeita. Os oito resultados de ruído acima ficaram vazios depois
da correção. Os seis trechos barrados pelo VAD também passaram pelo modelo real
no Chromium/WASM. Os dois trechos de anotação foram repetidos com Whisper real
em ONNX CPU e com a nova função de admissão de texto.

## Verificação do build

O worker gerado pelo build de produção também foi carregado em Chromium com os
modelos reais, sem microfone ou chamada de sala. Ele chegou ao estado `ready`,
retornou texto vazio para os seis recortes de ruído barrados e manteve texto não
vazio para o primeiro segmento com fala. Os downloads foram atendidos pelo cache
local dos mesmos modelos e runtimes; o áudio não saiu da máquina.

A suíte completa passou com 637 testes em 74 arquivos. Os 27 testes específicos
da nova admissão, do texto e do worker passaram. TypeScript, lint dos arquivos
alterados e build de produção também passaram.

## Testes permanentes

```sh
npm test
npm run test:local-speech-noise
npm run typecheck
npm run build
```

O teste de navegador executa o modelo real com silêncio, estalos repetidos,
palmas com decaimento, ruído constante, tom e três controles de fala sintética
(“Obrigado”, “Tchau” e “Oi”). Ele bloqueia acesso externo e usa um spy no lugar
da inferência Whisper, verificando que ruído não pode chamar o reconhecedor nem
gerar texto. O SHA-256 do modelo também é conferido. O CI executa este teste.
Os testes unitários cobrem o limiar, transientes separados, padding, PCM inválido,
reinício de estado, anotação, falas legítimas, protocolo do worker e falha de carga.

Para repetir com trechos privados, passe arquivos mono Float32 LE/16 kHz, cada
um contendo apenas ruído e no máximo 8,256 segundos:

```sh
npm run test:local-speech-noise -- /caminho/ruido.f32
```

A gravação do usuário e seus recortes ficaram fora dos arquivos versionados.
Os únicos WAV adicionados ao repositório são controles sintetizados localmente.
As validações acima foram executadas antes da publicação. A entrega em produção
segue o workflow de CI/CD Docker, com verificação da imagem e do healthcheck.
