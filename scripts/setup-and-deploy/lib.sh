# Shared settings for the setup-and-deploy scripts. Sourced, not run.
# shellcheck shell=bash
STAGE="${STAGE:-stg}"
export AWS_PROFILE="${AWS_PROFILE:-auth-app-deployer}"
REGION="${AWS_REGION:-ap-southeast-1}"
STACK="auth-app-$STAGE"
PARAM_PREFIX="/auth-app/$STAGE"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
export STAGE REGION STACK PARAM_PREFIX ROOT

die() { echo "error: $*" >&2; exit 1; }
