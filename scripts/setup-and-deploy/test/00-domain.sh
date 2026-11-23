#!/usr/bin/env bash
# Hermetic test for scripts/setup-and-deploy/00-domain.sh: a stub `aws` records every call and the
# put-parameter input file. Nothing reaches AWS, and ~/.aws is never read.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/home"
export HOME="$tmp/home" AWS_CONFIG_FILE=/dev/null AWS_SHARED_CREDENTIALS_FILE=/dev/null
export STAGE=t AWS_REGION=ap-southeast-1 ADMIN_PROFILE=adm LOG="$tmp/log"

cat >"$tmp/bin/aws" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$LOG"
args=" $* "
case "$args" in
  *" --profile adm "*) ;;
  *) echo "stub: not the admin profile: $args" >&2; exit 255 ;;
esac
case "$args" in
  *" ssm get-parameter "*"/credo/auth-gate/t/certificate-arn "*)
    [ "${SCENARIO:-}" = missing ] && { echo "An error occurred (ParameterNotFound)" >&2; exit 254; }
    echo arn:aws:acm:us-east-1:111122223333:certificate/abc ;;
  *" ssm put-parameter --cli-input-json file://"*)
    f="${args##*file://}"; f="${f%% *}"
    echo "mode $(stat -c %a "$f") $(cat "$f")" >>"$LOG" ;;
  *) echo "stub: unexpected call: $args" >&2; exit 255 ;;
esac
STUB
chmod +x "$tmp/bin/aws"
export PATH="$tmp/bin:$PATH"

fail=0
ok() { echo "ok - $1"; }
nok() { echo "not ok - $1"; fail=1; }

: >"$LOG"
rc=0
SCENARIO=ok bash "$root/scripts/setup-and-deploy/00-domain.sh" Mixed.Example.COM >"$tmp/out" 2>&1 || rc=$?
if [ "$rc" -eq 0 ] \
  && grep -q '^mode 600 {"Name":"/auth-app/t/domain","Value":"mixed.example.com","Type":"String","Overwrite":true}$' "$LOG" \
  && grep -q '^mode 600 {"Name":"/auth-app/t/certificate-arn","Value":"arn:aws:acm:us-east-1:111122223333:certificate/abc","Type":"String","Overwrite":true}$' "$LOG" \
  && grep -q mixed.example.com "$tmp/out" && grep -q certificate/abc "$tmp/out"; then
  ok "mixed-case domain is lowercased; the auth-gate ARN is copied; 0600 input files; values printed"
else nok "00-domain.sh wrong (rc=$rc)"; cat "$LOG" "$tmp/out"; fi

: >"$LOG"
rc=0
SCENARIO=missing bash "$root/scripts/setup-and-deploy/00-domain.sh" example.com >"$tmp/out" 2>&1 || rc=$?
if [ "$rc" -ne 0 ] && ! grep -q put-parameter "$LOG" && grep -q 00-cert.sh "$tmp/out"; then
  ok "missing auth-gate certificate parameter: dies with a clear message, writes nothing"
else nok "missing parameter not handled (rc=$rc)"; cat "$LOG" "$tmp/out"; fi

exit "$fail"
