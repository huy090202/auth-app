#!/usr/bin/env bash
# Deploy stack auth-app-$STAGE, upload app/dist, invalidate CloudFront, print BaseUrl.
# Needs AUTHGATE_BASE_URL, unless $PARAM_PREFIX/domain is set (00-domain.sh records it): then
# the default is https://api.<domain>, an explicit AUTHGATE_BASE_URL wins, and the stack gets
# DomainName and CertificateArn. Without a domain the deploy uses the CloudFront address.
# The deploy stops before sam if the certificate is missing or not ISSUED. AUTHGATE_CLIENT_ID may be empty on the first pass:
# deploy, run 02-register-client.sh stg (it needs this stack's BaseUrl), deploy again.
# Optional TRACE (default 1).
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
# shellcheck source=domain.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/domain.sh"

domain_config
[[ -z "$DOMAIN" ]] || AUTHGATE_BASE_URL="${AUTHGATE_BASE_URL:-https://api.$DOMAIN}"
[[ -n "${AUTHGATE_BASE_URL:-}" ]] || die "AUTHGATE_BASE_URL is required"
client_id="${AUTHGATE_CLIENT_ID:-}"
[[ -f "$ROOT/bff/dist/index.mjs" && -f "$ROOT/app/dist/index.html" ]] || die "build output missing; run 02-build.sh"

output() {
  aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

# With no client id given, tell a new stack (no client yet) from an existing one (it keeps the
# previous AuthGateClientId): describe-stacks fails when the stack does not exist.
stack_exists=0
if [[ -z "$client_id" ]] && aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].StackName" --output text >/dev/null 2>&1; then
  stack_exists=1
fi

# sam rejects empty overrides ("AuthGateClientId="); the template defaults it to "".
params=("Stage=$STAGE" "AuthGateBaseUrl=${AUTHGATE_BASE_URL%/}" "Trace=${TRACE:-1}")
[[ -z "$client_id" ]] || params+=("AuthGateClientId=$client_id")
[[ -z "$DOMAIN" ]] || params+=("DomainName=$DOMAIN" "CertificateArn=$CERT_ARN")
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
  if [[ "$stack_exists" == 1 ]]; then
    echo "AUTHGATE_CLIENT_ID is unset: the stack keeps its previous client id"
  else
    echo "AUTHGATE_CLIENT_ID is empty: /api returns 502 until the second pass. Now run 02-register-client.sh stg and deploy again"
  fi
fi
