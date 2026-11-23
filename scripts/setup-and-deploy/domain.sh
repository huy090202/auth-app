# Reader for the custom-domain configuration. Sourced by 03-deploy.sh, not run.
# shellcheck shell=bash
#
# The caller has already sourced lib.sh, which provides STAGE, REGION, PARAM_PREFIX and die().
# This file uses the ambient AWS_PROFILE (the deployer), never ADMIN_PROFILE, and defines only
# the functions below. 00-domain.sh records the two parameters.
#
#   domain_config   sets DOMAIN and CERT_ARN from $PARAM_PREFIX/domain and
#                   $PARAM_PREFIX/certificate-arn. With no `domain` parameter both are empty
#                   (deploy on the CloudFront address). With one, it exits unless the
#                   certificate-arn parameter exists and that ACM certificate (us-east-1) is
#                   ISSUED. It exits rather than returns, so it fails closed with or without
#                   `set -e`.

# _domain_param NAME: prints the value of $PARAM_PREFIX/NAME, or nothing when the parameter
# does not exist. Any other failure exits.
_domain_param() {
  local out err rc=0
  err="$(mktemp)"
  out="$(aws ssm get-parameter --region "$REGION" --name "$PARAM_PREFIX/$1" \
    --query Parameter.Value --output text 2>"$err")" || rc=$?
  if [ "$rc" -ne 0 ]; then
    if grep -q ParameterNotFound "$err"; then
      rm -f "$err"
      return 0
    fi
    echo "error: reading $PARAM_PREFIX/$1 failed:" >&2
    cat "$err" >&2
    rm -f "$err"
    exit 1
  fi
  rm -f "$err"
  printf '%s' "$out"
}

domain_config() {
  DOMAIN="$(_domain_param domain)" || exit 1
  CERT_ARN=""
  if [ -z "$DOMAIN" ]; then
    export DOMAIN CERT_ARN
    return 0
  fi
  CERT_ARN="$(_domain_param certificate-arn)" || exit 1
  [ -n "$CERT_ARN" ] || die "domain $DOMAIN is configured but $PARAM_PREFIX/certificate-arn is not: run scripts/setup-and-deploy/00-domain.sh $DOMAIN"
  local status
  status="$(aws acm describe-certificate --region us-east-1 --certificate-arn "$CERT_ARN" \
    --query Certificate.Status --output text)" || die "cannot describe certificate $CERT_ARN"
  [ "$status" = ISSUED ] || die "certificate $CERT_ARN is $status, not ISSUED: finish its DNS validation in auth-gate (00-cert.sh $DOMAIN --wait), then run 00-domain.sh $DOMAIN"
  export DOMAIN CERT_ARN
}
