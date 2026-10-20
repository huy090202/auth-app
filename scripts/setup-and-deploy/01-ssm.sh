#!/usr/bin/env bash
# Write random session-secret (SecureString) and origin-verify (String). Refuses to overwrite.
# origin-verify is a plain String: CloudFront origin headers cannot resolve a
# SecureString, and the value sits in clear text in the distribution config anyway.
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

for name in session-secret origin-verify; do
  # Only ParameterNotFound means absent; any other error stops before writing.
  if err="$(aws ssm get-parameter --region "$REGION" --name "$PARAM_PREFIX/$name" 2>&1 >/dev/null)"; then
    die "$PARAM_PREFIX/$name already exists; run 99-purge.sh first to replace it"
  elif [[ "$err" != *ParameterNotFound* ]]; then
    die "cannot read $PARAM_PREFIX/$name: $err"
  fi
done

for spec in session-secret:SecureString origin-verify:String; do
  name="${spec%%:*}"
  aws ssm put-parameter --region "$REGION" --name "$PARAM_PREFIX/$name" \
    --type "${spec#*:}" --value "$(openssl rand -hex 32)" >/dev/null
  echo "wrote $PARAM_PREFIX/$name (${spec#*:})"
done
