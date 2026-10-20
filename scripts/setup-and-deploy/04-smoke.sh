#!/usr/bin/env bash
# Smoke-test a deployed stage: run the Bruno collection against the BaseUrl in the
# stack outputs, then two curl checks on what only the real CloudFront door shows.
# Needs no key: the collection only calls the public /api, like the browser does.
# Exits non-zero on the first failure.
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

base_url="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='BaseUrl'].OutputValue" --output text)"
[[ -n "$base_url" && "$base_url" != "None" ]] || die "stack $STACK has no BaseUrl output; run 03-deploy.sh"
base_url="${base_url%/}"

# A throwaway, gitignored environment file for this run only.
env_file="$ROOT/bruno/environments/$STAGE.yml"
[[ ! -e "$env_file" ]] || die "$env_file exists; move it away so this run cannot clobber it"
trap 'rm -f "$env_file"' EXIT
cat >"$env_file" <<YAML
name: $STAGE
variables:
  - name: baseUrl
    value: "$base_url"
  - name: username
    value: ""
  - name: password
    value: correct-horse-battery
  - name: pin
    value: "482916"
YAML

echo "bruno: $base_url"
(cd "$ROOT/bruno" && npx -y @usebruno/cli run --env "$STAGE")

echo "curl: $base_url/docs/step-up"
headers="$(curl -sS -o /dev/null -D - -w 'status:%{http_code}\n' "$base_url/docs/step-up")"
grep -q '^status:200$' <<<"$headers" || die "/docs/step-up is not 200"
grep -qi '^content-type: *text/html' <<<"$headers" || die "/docs/step-up is not text/html"

echo "curl: $base_url/api/does-not-exist"
body="$(curl -sS -w '\nstatus:%{http_code}' "$base_url/api/does-not-exist")"
grep -q '^status:404$' <<<"$body" || die "/api/does-not-exist is not 404"
grep -q '^{"error":"not_found"' <<<"$body" || die "/api/does-not-exist body is not {\"error\":\"not_found\"...}"

echo "smoke ok"
