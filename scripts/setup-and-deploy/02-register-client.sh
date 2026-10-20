#!/usr/bin/env bash
# Register auth-app as a client of auth-gate: POST /api/clients with the admin key.
#   local: rpId localhost, origin http://localhost:5173; writes bff/.env.
#   stg:   rpId and origin from the stack's BaseUrl; writes the key to SSM
#          (SecureString) and prints the client id for 03-deploy.sh.
# Needs AUTHGATE_BASE_URL and AUTHGATE_ADMIN_KEY. The client key is shown once by
# auth-gate, so this refuses to overwrite a key that is already stored.
set -euo pipefail
target="${1:-}"
case "$target" in
  local) STAGE=local ;;
  stg) STAGE=stg ;;
  *) echo "usage: $0 stg|local" >&2; exit 2 ;;
esac
export STAGE
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[[ -n "${AUTHGATE_BASE_URL:-}" ]] || die "AUTHGATE_BASE_URL is required"
[[ -n "${AUTHGATE_ADMIN_KEY:-}" ]] || die "AUTHGATE_ADMIN_KEY is required"
command -v jq >/dev/null || die "jq is required"
base="${AUTHGATE_BASE_URL%/}"
env_file="$ROOT/bff/.env"

if [[ "$target" == local ]]; then
  if [[ -f "$env_file" ]] && grep -Eq '^AUTHGATE_CLIENT_KEY=.+' "$env_file"; then
    die "$env_file already has AUTHGATE_CLIENT_KEY; remove it first to register again"
  fi
  name="auth-app-local"
  rp_id="localhost"
  origin="http://localhost:5173"
else
  if aws ssm get-parameter --region "$REGION" --name "$PARAM_PREFIX/authgate-client-key" >/dev/null 2>&1; then
    die "$PARAM_PREFIX/authgate-client-key already exists; delete it first to register again"
  fi
  origin="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='BaseUrl'].OutputValue" --output text)"
  [[ -n "$origin" && "$origin" != None ]] || die "stack $STACK has no BaseUrl output; deploy it first"
  origin="${origin%/}"
  name="auth-app-$STAGE"
  rp_id="${origin#*://}"
  rp_id="${rp_id%%[/:]*}"
fi

body="$(jq -n --arg name "$name" --arg rp "$rp_id" --arg origin "$origin" \
  '{name: $name, rpId: $rp, origins: [$origin]}')"
resp="$(curl -sS --fail-with-body -X POST "$base/api/clients" \
  -H "x-internal-access-key: $AUTHGATE_ADMIN_KEY" \
  -H 'content-type: application/json' \
  -d "$body")" || die "POST $base/api/clients failed: $resp"
client_id="$(jq -r '.clientId // empty' <<<"$resp")"
access_key="$(jq -r '.accessKey // empty' <<<"$resp")"
[[ -n "$client_id" && -n "$access_key" ]] || die "unexpected response from auth-gate"

if [[ "$target" == local ]]; then
  touch "$env_file"
  tmp="$(mktemp)"
  grep -Ev '^(AUTHGATE_CLIENT_ID|AUTHGATE_CLIENT_KEY|AUTHGATE_BASE_URL)=' "$env_file" >"$tmp" || true
  {
    echo "AUTHGATE_BASE_URL=$base"
    echo "AUTHGATE_CLIENT_ID=$client_id"
    echo "AUTHGATE_CLIENT_KEY=$access_key"
  } >>"$tmp"
  mv "$tmp" "$env_file"
  chmod 600 "$env_file"
  echo "registered $name ($client_id); wrote $env_file"
else
  aws ssm put-parameter --region "$REGION" --name "$PARAM_PREFIX/authgate-client-key" \
    --type SecureString --value "$access_key" >/dev/null
  echo "registered $name; wrote $PARAM_PREFIX/authgate-client-key (SecureString)"
  echo "AUTHGATE_CLIENT_ID=$client_id   # pass this to 03-deploy.sh"
fi
