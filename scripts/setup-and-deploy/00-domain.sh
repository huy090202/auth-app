#!/usr/bin/env bash
# Admin, run once per stage: record the custom domain this stack serves on.
#
#   ADMIN_PROFILE=default ./00-domain.sh DOMAIN
#
# DOMAIN is lowercased (the redirect compares the Host header lowercased). The certificate is
# not requested here: it is auth-gate's, read from /credo/auth-gate/$STAGE/certificate-arn
# (run auth-gate's 00-cert.sh first). Writes $PARAM_PREFIX/domain and
# $PARAM_PREFIX/certificate-arn (String, overwritten), which 03-deploy.sh reads as the deployer.
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[ "$#" -eq 1 ] && [ -n "$1" ] || die "usage: 00-domain.sh DOMAIN"
domain="$(tr '[:upper:]' '[:lower:]' <<<"$1")"
[[ "$domain" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
  || die "'$1' is not a valid domain name (a bare hostname such as example.com: no scheme, path, port or spaces)"
profile="${ADMIN_PROFILE:-default}"

src="/credo/auth-gate/$STAGE/certificate-arn"
rc=0
errf="$(mktemp)"
arn="$(aws --profile "$profile" --region "$REGION" ssm get-parameter --name "$src" \
  --query Parameter.Value --output text 2>"$errf")" || rc=$?
if [ "$rc" -ne 0 ] && ! grep -q ParameterNotFound "$errf"; then
  echo "error: reading $src failed:" >&2
  cat "$errf" >&2
  rm -f "$errf"
  exit 1
fi
rm -f "$errf"
{ [ "$rc" -eq 0 ] && [ -n "$arn" ] && [ "$arn" != None ]; } \
  || die "cannot read $src: run auth-gate's scripts/setup-and-deploy/00-cert.sh $domain first, with the same STAGE"

umask 077
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
put() {
  printf '{"Name":"%s/%s","Value":"%s","Type":"String","Overwrite":true}\n' "$PARAM_PREFIX" "$1" "$2" >"$tmp/p.json"
  chmod 600 "$tmp/p.json"
  aws --profile "$profile" --region "$REGION" ssm put-parameter --cli-input-json "file://$tmp/p.json" >/dev/null
}
put domain "$domain"
put certificate-arn "$arn"
echo "domain:          $domain"
echo "certificate-arn: $arn"
echo "Wrote $PARAM_PREFIX/domain and $PARAM_PREFIX/certificate-arn"
