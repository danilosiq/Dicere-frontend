# Coesão após segmentação do texto

Execução explícita (cria e encerra sua própria sala de teste):

```sh
node --experimental-strip-types test/speech-translation/run-cohesion.mjs https://api.dicere.cloud
```

Usa diretamente o divisor TypeScript do produto, sem dividir frases manualmente.
Verifica limite, conteúdo original, contexto, identidade e resposta ACK. Falha
rapidamente em rejeições, desconexão ou ausência de entrega. Encerra a sala no
`finally` e verifica a resposta HTTP, sem imprimir senha/código/identidade da sala.

As entradas são textos sintéticos (alemão e inglês para português). Os resultados
servem para revisão semântica: o script **não** atribui aprovação de qualidade
automaticamente. Não exercita microfone, reconhecimento de voz, renderização da
legenda nem mede o SLA de 4 segundos após o fim da fala.

O divisor prioriza limites de frases reconhecidos por `Intl.Segmenter`; em
navegadores antigos, usa pontuação seguida de espaço/fim. É uma heurística, não
uma análise gramatical. Sem pontuação ou acima de 250 caracteres por frase, usa
palavras e, por último, corte sem separar pares UTF-16. Só normaliza espaços;
não corrige nomes, inventa palavras ou aguarda mais áudio. O backend mantém o
mesmo algoritmo para o pipeline STT interno.
