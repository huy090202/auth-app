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
  aws sts get-caller-identity --region "$REGION" >/dev/null || die "no AWS credentials for profile $AWS_PROFILE"
  # Only ParameterNotFound means absent; any other error stops before registering.
  if err="$(aws ssm get-parameter --region "$REGION" --name "$PARAM_PREFIX/authgate-client-key" 2>&1 >/dev/null)"; then
    die "$PARAM_PREFIX/authgate-client-key already exists; delete it first to register again"
  elif [[ "$err" != *ParameterNotFound* ]]; then
    die "cannot read $PARAM_PREFIX/authgate-client-key: $err"
  fi
  origin="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='BaseUrl'].OutputValue" --output text)"
  [[ -n "$origin" && "$origin" != None ]] || die "stack $STACK has no BaseUrl output; deploy it first"
  origin="${origin%/}"
  name="auth-app-$STAGE"
  rp_id="${origin#*://}"
  rp_id="${rp_id%%[/:]*}"
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
  jq -n --arg n "$PARAM_PREFIX/authgate-client-key" --arg v "$access_key" \
    '{Name: $n, Type: "SecureString", Value: $v}' >"$tmpdir/param"
  if ! aws ssm put-parameter --region "$REGION" --cli-input-json "file://$tmpdir/param" >/dev/null; then
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
fi
