#!/usr/bin/env bash
# Deploy stack auth-app-$STAGE, upload app/dist, invalidate CloudFront, print BaseUrl.
# Needs AUTHGATE_BASE_URL. AUTHGATE_CLIENT_ID may be empty on the first pass:
# deploy, run 02-register-client.sh stg (it needs this stack's BaseUrl), deploy again.
# Optional TRACE (default 1).
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

[[ -n "${AUTHGATE_BASE_URL:-}" ]] || die "AUTHGATE_BASE_URL is required"
client_id="${AUTHGATE_CLIENT_ID:-}"
[[ -f "$ROOT/bff/dist/index.mjs" && -f "$ROOT/app/dist/index.html" ]] || die "build output missing; run 02-build.sh"

output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

# sam rejects empty overrides ("AuthGateClientId="); the template defaults it to "".
params=("Stage=$STAGE" "AuthGateBaseUrl=${AUTHGATE_BASE_URL%/}" "Trace=${TRACE:-1}")
[[ -z "$client_id" ]] || params+=("AuthGateClientId=$client_id")
sam deploy --template-file "$ROOT/infra/template.yaml" \
  --stack-name "$STACK" --region "$REGION" \
  --capabilities CAPABILITY_IAM --resolve-s3 \
  --no-confirm-changeset --no-fail-on-empty-changeset \
  --parameter-overrides "${params[@]}"

bucket="$(output SiteBucket)"
dist="$(output DistributionId)"
aws s3 sync "$ROOT/app/dist" "s3://$bucket" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$dist" --paths '/*' >/dev/null
echo "invalidated $dist"

echo "BaseUrl: $(output BaseUrl)"
echo "RawBffUrl: $(output RawBffUrl)"
if [[ -z "$client_id" ]]; then
  echo "AUTHGATE_CLIENT_ID is empty: now run 02-register-client.sh stg and deploy again"
fi
