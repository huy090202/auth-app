#!/usr/bin/env bash
# Hermetic test for `02-register-client.sh stg [--replace]`: stub `aws` and `curl` first in PATH,
# scripts copied into a scratch tree. Nothing reaches AWS, and ~/.aws is never read. Calls are
# recorded; secrets must never appear in any argv or in the output.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/home" "$tmp/tree/scripts/setup-and-deploy"
cp "$root/scripts/setup-and-deploy/lib.sh" "$root/scripts/setup-and-deploy/domain.sh" \
  "$root/scripts/setup-and-deploy/02-register-client.sh" "$tmp/tree/scripts/setup-and-deploy/"
export HOME="$tmp/home" AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null
export AWS_PROFILE=stub AWS_REGION=ap-southeast-1
export AUTHGATE_BASE_URL=https://api.example.test
ADMIN_SECRET="admin-secret-xyz"
CLIENT_SECRET="client-secret-abc"
export AUTHGATE_ADMIN_KEY="$ADMIN_SECRET"

# Env: HOST (the stack's BaseUrl host), STORED (1/0), DOMAINSET (1/0), HTTP (POST status).
cat >"$tmp/bin/aws" <<'STUB'
#!/usr/bin/env bash
echo "aws $*" >>"$CALLS"
args=" $* "
notfound() { echo "An error occurred (ParameterNotFound) when calling the GetParameter operation" >&2; exit 254; }
case "$args" in
  *" sts "*) echo '{}' ;;
  *" ssm get-parameter "*)
    case "$args" in
      *"/auth-app/stg/domain "*) [ "$DOMAINSET" = 1 ] && echo authgatehq.com || notfound ;;
      *"/auth-app/stg/certificate-arn "*) echo arn:aws:acm:us-east-1:111122223333:certificate/abc ;;
      *authgate-client-key*) [ "$STORED" = 1 ] && echo '{}' || notfound ;;
      *) echo "stub: unexpected parameter: $args" >&2; exit 255 ;;
    esac ;;
  *" acm describe-certificate "*) echo ISSUED ;;
  *" ssm put-parameter "*) ;;
  *" cloudformation describe-stacks "*)
    case "$args" in
      *AuthGateClientId*) echo "old-client-id" ;;
      *) echo "https://$HOST" ;;
    esac ;;
  *) echo "stub: unexpected call: $args" >&2; exit 255 ;;
esac
STUB
cat >"$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
echo "curl $*" >>"$CALLS"
body=""
while [ $# -gt 0 ]; do
  case "$1" in
    --data-binary) body="${2#@}"; shift ;;
    -o) out="$2"; shift ;;
  esac
  shift
done
cp "$body" "$BODY_COPY"
if [ "$HTTP" = 201 ]; then
  printf '{"clientId":"new-client-id","accessKey":"%s"}' "$CLIENT_SECRET" >"$out"
else
  printf '{"error":"boom"}' >"$out"
fi
printf '%s' "$HTTP"
STUB
chmod +x "$tmp/bin/aws" "$tmp/bin/curl"
export PATH="$tmp/bin:$PATH" ADMIN_SECRET CLIENT_SECRET CALLS="$tmp/calls" BODY_COPY="$tmp/body"
export HTTP=201

fail=0
ok() { echo "ok - $1"; }
nok() { echo "not ok - $1"; fail=1; }

# run ANSWER ARGS...: ANSWER is fed on stdin; calls, output and exit code are kept.
run() {
  local answer="$1"
  shift
  : >"$CALLS"
  rm -f "$BODY_COPY"
  rc=0
  printf '%s\n' "$answer" | bash "$tmp/tree/scripts/setup-and-deploy/02-register-client.sh" "$@" >"$tmp/out" 2>&1 || rc=$?
}
posts() { grep -c '^curl ' "$CALLS" || true; }
puts() { grep -c 'ssm put-parameter' "$CALLS" || true; }

export DOMAINSET=1 STORED=1 HOST="authgatehq.com"

run "" stg
if [ "$rc" -ne 0 ] && [ "$(posts)" -eq 0 ] && [ "$(puts)" -eq 0 ] && grep -q -e "--replace" "$tmp/out"; then
  ok "stored key without --replace refuses, no POST"
else nok "stored key without --replace (rc=$rc)"; cat "$tmp/out"; fi

run "yes" stg --replace
if [ "$rc" -ne 0 ] && [ "$(posts)" -eq 0 ] && [ "$(puts)" -eq 0 ]; then
  ok "--replace with a wrong answer changes nothing"
else nok "wrong answer (rc=$rc)"; cat "$tmp/out"; fi

run "" stg --replace
if [ "$rc" -ne 0 ] && [ "$(posts)" -eq 0 ] && [ "$(puts)" -eq 0 ]; then
  ok "--replace with EOF on stdin changes nothing"
else nok "EOF answer (rc=$rc)"; cat "$tmp/out"; fi

run "replace auth-app-stg" stg --replace
if [ "$rc" -eq 0 ] && [ "$(posts)" -eq 1 ] && [ "$(puts)" -eq 1 ] \
  && grep 'ssm put-parameter' "$CALLS" | grep -q -e '--overwrite' \
  && [ "$(jq -r .rpId "$BODY_COPY")" = "authgatehq.com" ] \
  && [ "$(jq -r '.origins[0]' "$BODY_COPY")" = "https://authgatehq.com" ] \
  && grep -q "disable the old client old-client-id in the Console" "$tmp/out" \
  && grep -q "AUTHGATE_CLIENT_ID=new-client-id" "$tmp/out"; then
  ok "--replace with the exact answer: one POST (right rpId, origin), one overwrite, old id printed"
else nok "exact answer (rc=$rc)"; cat "$CALLS" "$tmp/out"; fi
if grep '^curl ' "$CALLS" | grep -q -e '--connect-timeout 5 --max-time 30'; then
  ok "the POST has a connect and a total timeout"
else nok "the POST has no timeouts"; cat "$CALLS"; fi
if ! grep -q -e "$ADMIN_SECRET" -e "$CLIENT_SECRET" "$CALLS" "$tmp/out"; then
  ok "neither key appears in any argv or in the output"
else nok "a secret leaked"; cat "$CALLS"; fi

HTTP=500 run "replace auth-app-stg" stg --replace
if [ "$rc" -ne 0 ] && [ "$(posts)" -eq 1 ] && [ "$(puts)" -eq 0 ]; then
  ok "a POST answering 500: the stored key is untouched"
else nok "500 handling (rc=$rc)"; cat "$CALLS" "$tmp/out"; fi

HOST="d111.cloudfront.net" run "replace auth-app-stg" stg --replace
if [ "$rc" -ne 0 ] && [ "$(posts)" -eq 0 ] && [ "$(puts)" -eq 0 ] && grep -q "deploy with the domain first" "$tmp/out"; then
  ok "BaseUrl still on cloudfront.net dies before any POST"
else nok "cloudfront host not refused (rc=$rc)"; cat "$tmp/out"; fi

DOMAINSET=0 HOST="d111.cloudfront.net" run "replace auth-app-stg" stg --replace
if [ "$rc" -eq 0 ] && [ "$(posts)" -eq 1 ] && [ "$(jq -r .rpId "$BODY_COPY")" = "d111.cloudfront.net" ]; then
  ok "no domain configured: --replace works without the host check"
else nok "no-domain replace (rc=$rc)"; cat "$tmp/out"; fi

STORED=0 DOMAINSET=0 HOST="d111.cloudfront.net" run "" stg --replace
if [ "$rc" -eq 0 ] && [ "$(posts)" -eq 1 ] && [ "$(puts)" -eq 1 ] && ! grep -q "Type 'replace" "$tmp/out"; then
  ok "no stored key: --replace registers without a prompt"
else nok "no stored key replace (rc=$rc)"; cat "$tmp/out"; fi

run "" local --replace
if [ "$rc" -eq 2 ] && [ "$(posts)" -eq 0 ]; then
  ok "local --replace is a usage error (exit 2)"
else nok "local --replace (rc=$rc)"; cat "$tmp/out"; fi

exit "$fail"
