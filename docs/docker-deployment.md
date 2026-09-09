# CI/CD Docker do Dicere

O workflow executa CI em pushes e PRs para `main` e `dev`. Após CI aprovado em um push para `main` (ou execução manual nessa branch), constrói e publica a imagem em `ghcr.io/danilosiq/dicere-frontend`, com tag do commit. O deploy usa o digest imutável retornado pelo build.

## Configuração inicial

A configuração do servidor ainda é necessária. Sem ela, a etapa de deploy falha explicitamente; CI aprovado ou imagem publicada não significa que o site foi atualizado.

No GitHub, configure em Settings → Secrets and variables → Actions (ou no environment `production`):

| Tipo     | Nome                | Conteúdo                                                                               |
| -------- | ------------------- | -------------------------------------------------------------------------------------- |
| Variable | DEPLOY_HOST         | Host/IP SSH do servidor                                                                |
| Variable | DEPLOY_PORT         | Porta SSH (padrão 22)                                                                  |
| Variable | DEPLOY_USER         | Usuário SSH com acesso ao Docker e ao diretório do Compose                             |
| Variable | DEPLOY_COMPOSE_FILE | Caminho absoluto do arquivo Compose de produção                                        |
| Variable | DEPLOY_PROJECT      | Nome exato do projeto Compose que já está rodando                                      |
| Variable | DEPLOY_SERVICE      | Nome exato do serviço deste repositório no Compose                                     |
| Secret   | DEPLOY_SSH_KEY      | Chave privada dedicada ao deploy; não enviar em chat nem commitar                      |
| Secret   | DEPLOY_KNOWN_HOSTS  | Chave pública do host SSH, validada por canal confiável; incluir a porta se não for 22 |

O servidor precisa de Bash, `flock`, Docker Engine e Compose V2 com suporte a `up --wait`. A imagem é construída para Linux amd64; confirmar a arquitetura antes de habilitar produção. O serviço deve estar em execução, com exatamente um contêiner. Configuração, portas, redes, restart policy e volumes continuam vindo do Compose existente.

Para pacotes GHCR privados, o usuário de deploy precisa de login Docker prévio no GHCR usando credencial com somente `read:packages` e acesso ao pacote. O workflow publica usando seu `GITHUB_TOKEN`; essa credencial não é enviada ao servidor. O pacote deve permanecer privado, salvo decisão explícita de torná-lo público.

## Atualização e rollback

O script valida o serviço existente, guarda uma tag local para a imagem anterior e baixa a nova antes de atualizar o contêiner. Usa `up -d --no-deps --no-build --wait`, verifica a imagem efetiva e o healthcheck. Se falhar, tenta restaurar a imagem anterior e mantém a execução do GitHub como falha. Não executa `compose down`, `prune` nem remove volumes.

As imagens possuem healthchecks HTTP. Eles confirmam resposta do processo; não comprovam disponibilidade do banco, Redis, provedor de tradução ou reconhecimento do navegador. A recriação de um único contêiner pode interromper conexões em andamento; este fluxo não promete deploy sem interrupção.

O script grava overrides em `.dicere-cd/<serviço>.json`, no diretório do Compose. Um lock nesse diretório serializa deploys de front/back quando compartilham o mesmo Compose. Cada execução inclui todos esses overrides para preservar a versão do outro serviço. Operações manuais futuras precisam incluir os overrides; usar apenas o arquivo base pode restaurar a imagem antiga. A pasta não contém segredos e não deve ser apagada durante a operação.

No backend, migrações de banco não são executadas automaticamente. Migrações necessárias a uma nova versão devem ser aplicadas de forma compatível antes da atualização; rollback de imagem não desfaz migrações.

## Verificação

- `bash -n scripts/deploy.sh scripts/deploy-remote.sh`
- `node --test scripts/deploy-remote.check.mjs`
- CI do projeto e build Docker.
- No GitHub, os jobs `quality`, `image` e `deploy` precisam terminar com sucesso.
- Confirmar versão e comportamento em https://dicere.cloud e https://api.dicere.cloud.

A integração da Vercel é independente deste fluxo. Um deploy concluído na Vercel não comprova atualização do servidor Docker.
