#!/usr/bin/env bash
# Register auth-app as a client of auth-gate: POST /api/clients with the admin key.
#   local: rpId localhost, origin http://localhost:5173; writes bff/.env.
#   stg:   rpId and origin from the stack's BaseUrl; writes the key to SSM
#          (SecureString) and prints the client id for 03-deploy.sh.
# Needs AUTHGATE_BASE_URL and AUTHGATE_ADMIN_KEY. The client key is shown once by
# auth-gate, so this refuses to overwrite a key that is already stored.
#   stg --replace: for a new rpId (the custom domain). AuthGate refuses an rpId change, so this
#          registers a NEW client and overwrites the stored key, after a typed confirmation read
#          from stdin. With a domain configured the stack's BaseUrl must already be on it.
set -euo pipefail
usage() { echo "usage: $0 stg [--replace] | local" >&2; exit 2; }
target="${1:-}"
replace=0
case "$target" in
  local) [[ $# -eq 1 ]] || usage; STAGE=local ;;
  stg)
    case "${2:-}" in
      "") [[ $# -eq 1 ]] || usage ;;
      --replace) [[ $# -eq 2 ]] || usage; replace=1 ;;
      *) usage ;;
    esac
    STAGE=stg ;;
  *) usage ;;
esac
export STAGE
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=domain.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/domain.sh"

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
  aws sts get-caller-identity --region "$REGION" >/dev/null || die "no AWS credentials for profile $AWS_PROFILE"
  # Only ParameterNotFound means absent; any other error stops before registering.
  stored=0
  if err="$(aws ssm get-parameter --region "$REGION" --name "$PARAM_PREFIX/authgate-client-key" 2>&1 >/dev/null)"; then
    [[ "$replace" == 1 ]] || die "$PARAM_PREFIX/authgate-client-key already exists; to register a new client for a new rpId run: $0 stg --replace"
    stored=1
  elif [[ "$err" != *ParameterNotFound* ]]; then
    die "cannot read $PARAM_PREFIX/authgate-client-key: $err"
  fi
  stack_query() {
    aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query "$1" --output text
  }
  origin="$(stack_query "Stacks[0].Outputs[?OutputKey=='BaseUrl'].OutputValue")"
  [[ -n "$origin" && "$origin" != None ]] || die "stack $STACK has no BaseUrl output; deploy it first"
  origin="${origin%/}"
  name="auth-app-$STAGE"
  rp_id="${origin#*://}"
  rp_id="${rp_id%%[/:]*}"
  old_id=""
  if [[ "$stored" == 1 ]]; then
    domain_config
    old_id="$(stack_query "Stacks[0].Parameters[?ParameterKey=='AuthGateClientId'].ParameterValue" 2>/dev/null)" || old_id=""
    [[ "$old_id" != None ]] || old_id=""
    if [[ -n "$DOMAIN" ]]; then
      [[ "$rp_id" == "$DOMAIN" ]] || die "stack $STACK BaseUrl host is '${rp_id:-none}', not $DOMAIN: deploy with the domain first"
      origin="https://$DOMAIN"
    fi
    printf "Type 'replace %s' to register a new client and overwrite the stored key: " "$STACK" >&2
    answer=""
    read -r answer || true
    [[ "$answer" == "replace $STACK" ]] || die "not confirmed; nothing changed"
  fi
fi

# Secrets go through 0600 temp files, never argv.
tmpdir="$(mktemp -d)"
chmod 700 "$tmpdir"
trap 'rm -rf "$tmpdir"' EXIT
printf 'x-internal-access-key: %s\n' "$AUTHGATE_ADMIN_KEY" >"$tmpdir/headers"
jq -n --arg name "$name" --arg rp "$rp_id" --arg origin "$origin" \
  '{name: $name, rpId: $rp, origins: [$origin]}' >"$tmpdir/body"
status="$(curl -sS -o "$tmpdir/resp" -w '%{http_code}' -X POST "$base/api/clients" \
  -H @"$tmpdir/headers" -H 'content-type: application/json' \
  --data-binary @"$tmpdir/body")" || die "POST $base/api/clients: network error"
if [[ "$status" != 201 ]]; then
  # Status and error code only: the body is not echoed.
  die "POST $base/api/clients -> $status $(jq -r '.error // empty' "$tmpdir/resp" 2>/dev/null || true)"
fi
client_id="$(jq -r '.clientId // empty' "$tmpdir/resp")"
access_key="$(jq -r '.accessKey // empty' "$tmpdir/resp")"
[[ -n "$client_id" && -n "$access_key" ]] || die "unexpected response from auth-gate"

if [[ "$target" == local ]]; then
  # A fresh .env starts from the example so PORT, TABLE, SESSION_SECRET etc. are set.
  [[ -f "$env_file" ]] || cp "$ROOT/bff/.env.example" "$env_file"
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
  jq --arg n "$PARAM_PREFIX/authgate-client-key" \
    '{Name: $n, Type: "SecureString", Value: .accessKey}' "$tmpdir/resp" >"$tmpdir/param"
  overwrite=()
  [[ "$replace" == 1 ]] && overwrite=(--overwrite)
  if ! aws ssm put-parameter --region "$REGION" ${overwrite[@]+"${overwrite[@]}"} --cli-input-json "file://$tmpdir/param" >/dev/null; then
    {
      echo "error: registered client $client_id but could not write $PARAM_PREFIX/authgate-client-key."
      echo "The client key is not recoverable from auth-gate. Rotate it with"
      echo "  POST $base/api/clients/$client_id/keys (admin key header)"
      echo "and store the returned accessKey in $PARAM_PREFIX/authgate-client-key (SecureString)."
    } >&2
    exit 1
  fi
  echo "registered $name; wrote $PARAM_PREFIX/authgate-client-key (SecureString)"
  echo "AUTHGATE_CLIENT_ID=$client_id   # pass this to 03-deploy.sh"
  if [[ "$replace" == 1 ]]; then
    if [[ -n "$old_id" ]]; then
      echo "disable the old client $old_id in the Console once the new one works"
    else
      echo "disable the old client in the Console once the new one works (its id could not be read from $STACK)"
    fi
  fi
fi
