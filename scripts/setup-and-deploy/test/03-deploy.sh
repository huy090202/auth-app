#!/usr/bin/env bash
# Hermetic test for scripts/setup-and-deploy/03-deploy.sh and the domain parameters it passes:
# stub `aws` and `sam` first in PATH (sam records argv and fails, so nothing after it runs), the
# scripts copied into a scratch tree. Nothing reaches AWS, and ~/.aws is never read.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/home" "$tmp/tree/scripts/setup-and-deploy" "$tmp/tree/infra" \
  "$tmp/tree/bff/dist" "$tmp/tree/app/dist"
cp "$root/scripts/setup-and-deploy/lib.sh" "$root/scripts/setup-and-deploy/domain.sh" \
  "$root/scripts/setup-and-deploy/03-deploy.sh" "$tmp/tree/scripts/setup-and-deploy/"
: >"$tmp/tree/bff/dist/index.mjs"
: >"$tmp/tree/app/dist/index.html"
: >"$tmp/tree/infra/template.yaml"
export HOME="$tmp/home" AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null
export AWS_PROFILE=stub STAGE=t AWS_REGION=ap-southeast-1

# Scenarios: absent (no domain), issued, pending.
cat >"$tmp/bin/aws" <<'STUB'
#!/usr/bin/env bash
args=" $* "
notfound() { echo "An error occurred (ParameterNotFound) when calling the GetParameter operation" >&2; exit 254; }
case "$args" in
  *" ssm get-parameter "*)
    case "$args" in
      *"/auth-app/t/domain "*) [ "$SCENARIO" = absent ] && notfound; echo authgatehq.com ;;
      *"/auth-app/t/certificate-arn "*) echo arn:aws:acm:us-east-1:111122223333:certificate/abc ;;
      *) echo "stub: unexpected parameter: $args" >&2; exit 255 ;;
    esac ;;
  *" cloudformation describe-stacks "*)
    [ "${STACKSTATE:-new}" = new ] && [ ! -e "$SAM_LOG.deployed" ] && { echo "An error occurred (ValidationError): Stack does not exist" >&2; exit 254; }
    echo x ;;
  *" s3 sync "*|*" cloudfront create-invalidation "*) ;;
  *" acm describe-certificate "*)
    [ "$SCENARIO" = pending ] && echo PENDING_VALIDATION || echo ISSUED ;;
  *) echo "stub: unexpected call: $args" >&2; exit 255 ;;
esac
STUB
cat >"$tmp/bin/sam" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$SAM_LOG"
touch "$SAM_LOG.deployed"
exit "${SAM_RC:-1}"
STUB
chmod +x "$tmp/bin/aws" "$tmp/bin/sam"
export PATH="$tmp/bin:$PATH"

fail=0
ok() { echo "ok - $1"; }
nok() { echo "not ok - $1"; fail=1; }

# run SCENARIO [VAR=value...]: the deploy with AUTHGATE_BASE_URL unset unless given.
run() {
  local sc="$1"
  shift
  export SCENARIO="$sc" SAM_LOG="$tmp/sam.log"
  : >"$SAM_LOG"
  rm -f "$SAM_LOG.deployed"
  rc=0
  env -u AUTHGATE_BASE_URL -u AUTHGATE_CLIENT_ID "$@" \
    bash "$tmp/tree/scripts/setup-and-deploy/03-deploy.sh" >"$tmp/out" 2>&1 || rc=$?
}

run issued
if [ "$(wc -l <"$SAM_LOG")" -eq 1 ] \
  && grep -q -- "DomainName=authgatehq.com" "$SAM_LOG" \
  && grep -q -- "CertificateArn=arn:aws:acm:us-east-1:111122223333:certificate/abc" "$SAM_LOG" \
  && grep -q -- "AuthGateBaseUrl=https://api.authgatehq.com " "$SAM_LOG"; then
  ok "domain: DomainName, CertificateArn and the default AuthGateBaseUrl are passed"
else nok "domain: overrides wrong (rc=$rc)"; cat "$SAM_LOG" "$tmp/out"; fi

run issued AUTHGATE_BASE_URL=https://explicit.example/
if grep -q -- "AuthGateBaseUrl=https://explicit.example " "$SAM_LOG" && grep -q -- "DomainName=authgatehq.com" "$SAM_LOG"; then
  ok "domain: an explicit AUTHGATE_BASE_URL wins"
else nok "domain: explicit AUTHGATE_BASE_URL lost (rc=$rc)"; cat "$SAM_LOG" "$tmp/out"; fi

run absent AUTHGATE_BASE_URL=https://api.example.test
if [ -s "$SAM_LOG" ] && ! grep -q -e "DomainName=" -e "CertificateArn=" "$SAM_LOG" \
  && grep -q -- "AuthGateBaseUrl=https://api.example.test " "$SAM_LOG"; then
  ok "no domain: no DomainName or CertificateArn override"
else nok "no domain: overrides wrong (rc=$rc)"; cat "$SAM_LOG" "$tmp/out"; fi

run absent
if [ "$rc" -ne 0 ] && [ ! -s "$SAM_LOG" ] && grep -q AUTHGATE_BASE_URL "$tmp/out"; then
  ok "no domain: AUTHGATE_BASE_URL stays required"
else nok "no domain: AUTHGATE_BASE_URL not required (rc=$rc)"; cat "$SAM_LOG" "$tmp/out"; fi

run pending
if [ "$rc" -ne 0 ] && [ ! -s "$SAM_LOG" ] && grep -q PENDING_VALIDATION "$tmp/out"; then
  ok "domain with a pending certificate: dies before sam deploy"
else nok "pending certificate did not stop the deploy (rc=$rc)"; cat "$SAM_LOG" "$tmp/out"; fi

# The closing message depends on whether the stack exists (sam succeeds here).
run absent AUTHGATE_BASE_URL=https://api.example.test SAM_RC=0 STACKSTATE=new
if [ "$rc" -eq 0 ] && grep -q "/api returns 502" "$tmp/out" && ! grep -q "keeps its previous" "$tmp/out"; then
  ok "new stack, no client id: the 502 message"
else nok "new stack message wrong (rc=$rc)"; cat "$tmp/out"; fi

run absent AUTHGATE_BASE_URL=https://api.example.test SAM_RC=0 STACKSTATE=exists
if [ "$rc" -eq 0 ] && grep -q "keeps its previous client id" "$tmp/out" && ! grep -q "502" "$tmp/out"; then
  ok "existing stack, no client id: it keeps its previous client id"
else nok "existing stack message wrong (rc=$rc)"; cat "$tmp/out"; fi

run absent AUTHGATE_BASE_URL=https://api.example.test SAM_RC=0 STACKSTATE=exists AUTHGATE_CLIENT_ID=c1
if [ "$rc" -eq 0 ] && ! grep -q -e "502" -e "previous client id" "$tmp/out"; then
  ok "client id given: no client id message"
else nok "client id given but a message printed (rc=$rc)"; cat "$tmp/out"; fi

exit "$fail"
