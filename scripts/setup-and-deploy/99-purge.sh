#!/usr/bin/env bash
# Empty the site bucket, delete stack auth-app-$STAGE and its three SSM parameters,
# after a typed confirmation.
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

read -r -p "Type '$STACK' to delete the stack, its bucket contents and SSM parameters: " answer
[[ "$answer" == "$STACK" ]] || die "confirmation did not match; nothing deleted"

# A non-empty bucket blocks stack deletion. A missing stack means nothing to empty.
if bucket="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='SiteBucket'].OutputValue" --output text 2>/dev/null)" \
  && [[ -n "$bucket" && "$bucket" != None ]]; then
  aws s3 rm "s3://$bucket" --recursive --region "$REGION"
  echo "emptied $bucket"
fi

aws cloudformation delete-stack --region "$REGION" --stack-name "$STACK"
aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$STACK"
echo "deleted stack $STACK"

for name in session-secret origin-verify authgate-client-key; do
  if err="$(aws ssm delete-parameter --region "$REGION" --name "$PARAM_PREFIX/$name" 2>&1)"; then
    echo "deleted $PARAM_PREFIX/$name"
  elif [[ "$err" == *ParameterNotFound* ]]; then
    echo "skip $PARAM_PREFIX/$name (absent)"
  else
    die "delete $PARAM_PREFIX/$name failed: $err"
  fi
done
