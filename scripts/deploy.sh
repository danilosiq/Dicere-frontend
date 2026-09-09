#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEPLOY_HOST:?Configure DEPLOY_HOST}"
: "${DEPLOY_USER:?Configure DEPLOY_USER}"
: "${DEPLOY_PORT:?Configure DEPLOY_PORT}"
: "${DEPLOY_COMPOSE_FILE:?Configure DEPLOY_COMPOSE_FILE}"
: "${DEPLOY_PROJECT:?Configure DEPLOY_PROJECT}"
: "${DEPLOY_SERVICE:?Configure DEPLOY_SERVICE}"
: "${DEPLOY_SSH_KEY:?Configure o secret DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?Configure o secret DEPLOY_KNOWN_HOSTS}"
: "${DEPLOY_IMAGE:?Imagem com digest ausente}"

[[ "$DEPLOY_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$DEPLOY_USER" =~ ^[a-zA-Z_][a-zA-Z0-9_-]*$ ]]
[[ "$DEPLOY_PORT" =~ ^[0-9]+$ ]]
(( DEPLOY_PORT > 0 && DEPLOY_PORT <= 65535 ))

umask 077
ssh_dir=$(mktemp -d)
trap 'rm -f "$ssh_dir/key" "$ssh_dir/known_hosts"; rmdir "$ssh_dir"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$ssh_dir/key"
printf '%s\n' "$DEPLOY_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
unset DEPLOY_SSH_KEY DEPLOY_KNOWN_HOSTS
printf -v command 'bash -s -- %q %q %q %q' "$DEPLOY_IMAGE" "$DEPLOY_COMPOSE_FILE" "$DEPLOY_PROJECT" "$DEPLOY_SERVICE"
ssh -i "$ssh_dir/key" -p "$DEPLOY_PORT" \
  -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes \
  -o "UserKnownHostsFile=$ssh_dir/known_hosts" \
  "$DEPLOY_USER@$DEPLOY_HOST" "$command" < scripts/deploy-remote.sh

