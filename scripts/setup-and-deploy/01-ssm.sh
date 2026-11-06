#!/usr/bin/env bash
# Write random session-secret (SecureString) and origin-verify (String) if absent.
# Never overwrites: an existing parameter is kept, so a rerun after a partial write
# fills only the missing one. Use 99-purge.sh first to replace values.
# origin-verify is a plain String: CloudFront origin headers cannot resolve a
# SecureString, and the value sits in clear text in the distribution config anyway.
# Values never go on argv: each is passed through --cli-input-json from a private temp dir.
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

tmp="$(mktemp -d)"
chmod 700 "$tmp"
trap 'rm -rf "$tmp"' EXIT

missing=()
for spec in session-secret:SecureString origin-verify:String; do
  name="${spec%%:*}"
  # Only ParameterNotFound means absent; any other error stops before writing.
  if err="$(aws ssm get-parameter --region "$REGION" --name "$PARAM_PREFIX/$name" 2>&1 >/dev/null)"; then
    echo "kept $PARAM_PREFIX/$name (already exists)"
  elif [[ "$err" == *ParameterNotFound* ]]; then
    missing+=("$spec")
  else
    die "cannot read $PARAM_PREFIX/$name: $err"
  fi
done

for spec in ${missing[@]+"${missing[@]}"}; do
  name="${spec%%:*}"
  input="$tmp/$name.json"
  # The value goes openssl -> jq stdin -> 0600 file, never through any argv.
  (umask 077 && openssl rand -hex 32 | jq -R --arg n "$PARAM_PREFIX/$name" --arg t "${spec#*:}" \
    '{Name: $n, Type: $t, Value: .}' >"$input")
  aws ssm put-parameter --region "$REGION" --cli-input-json "file://$input" >/dev/null
  rm -f "$input"
  echo "wrote $PARAM_PREFIX/$name (${spec#*:})"
done
