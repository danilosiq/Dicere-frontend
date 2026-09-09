#!/usr/bin/env bash
set -Eeuo pipefail
export -n GHCR_TOKEN

[[ "$#" -eq 4 ]] || { echo "Esperados: imagem, compose, projeto, serviço" >&2; exit 1; }
image="$1"
compose_file="$2"
project="$3"
service="$4"
[[ "$image" =~ ^ghcr.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]
[[ "$compose_file" == /* && -f "$compose_file" ]]
[[ "$project" =~ ^[a-z0-9][a-z0-9_-]*$ ]]
[[ "$service" =~ ^[a-zA-Z0-9][a-zA-Z0-9_-]*$ ]]
command -v flock >/dev/null

cd "$(dirname "$compose_file")"
umask 077
mkdir -p .dicere-cd
# Front e back podem compartilhar o mesmo Compose.
exec 9>.dicere-cd/deploy.lock
flock -w 300 9
compose=(docker compose --project-name "$project" -f "$compose_file")
shopt -s nullglob
for override in .dicere-cd/*.json; do compose+=(-f "$override"); done

container=$("${compose[@]}" ps -q "$service")
[[ -n "$container" && "$container" != *$'\n'* ]] || {
  echo "O serviço precisa ter exatamente um contêiner em execução; confira projeto e serviço." >&2
  exit 1
}
old_image=$(docker inspect --format '{{.Config.Image}}' "$container")
old_id=$(docker inspect --format '{{.Image}}' "$container")
# Mantém a imagem anterior disponível para rollback, mesmo se a tag mudar.
rollback_image="dicere-rollback/$project-$service:previous"
docker tag "$old_id" "$rollback_image"
pull_image() (
  if [[ -n "${GHCR_TOKEN:-}" ]]; then
    : "${GHCR_USER:?Usuário do registry ausente}"
    registry_dir=$(mktemp -d)
    export DOCKER_CONFIG="$registry_dir"
    trap 'rm -f "$registry_dir/config.json"; rmdir "$registry_dir"' EXIT
    printf '%s\n' "$GHCR_TOKEN" | docker login ghcr.io --username "$GHCR_USER" --password-stdin
    unset GHCR_TOKEN
  fi
  docker pull "$image"
)
pull_image
unset GHCR_TOKEN
healthcheck=$(docker image inspect --format '{{json .Config.Healthcheck.Test}}' "$image")
[[ "$healthcheck" == *CMD* ]] || { echo "A imagem não possui healthcheck." >&2; exit 1; }

override=".dicere-cd/$service.json"
# Reconstrói a lista após criar o override para incluir a primeira implantação.
printf '{"services":{"%s":{"image":"%s","pull_policy":"never"}}}\n' "$service" "$image" > "$override"
compose=(docker compose --project-name "$project" -f "$compose_file")
for file in .dicere-cd/*.json; do compose+=(-f "$file"); done

rollback() {
  echo "Deploy falhou; restaurando $old_image." >&2
  printf '{"services":{"%s":{"image":"%s","pull_policy":"never"}}}\n' "$service" "$rollback_image" > "$override"
  "${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 120 "$service"
}
fail_deploy() {
  trap - ERR INT TERM
  rollback
  exit 1
}
trap fail_deploy ERR INT TERM
if ! "${compose[@]}" up -d --no-deps --no-build --wait --wait-timeout 120 "$service"; then
  fail_deploy
fi
deployed=$("${compose[@]}" ps -q "$service")
expected_id=$(docker image inspect --format '{{.Id}}' "$image")
actual_id=$(docker inspect --format '{{.Image}}' "$deployed")
actual_health=$(docker inspect --format '{{.State.Health.Status}}' "$deployed")
if [[ "$actual_id" != "$expected_id" || "$actual_health" != healthy ]]; then
  fail_deploy
fi
trap - ERR INT TERM
printf 'Deploy confirmado: %s (%s)\n' "$service" "$image"
