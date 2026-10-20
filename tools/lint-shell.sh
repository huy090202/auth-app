#!/usr/bin/env bash
# Run shellcheck over every tracked shell script that exists (globs may match nothing yet).
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s nullglob globstar
files=(tools/lint-shell.sh scripts/setup-and-deploy/*.sh tools/wt/*.sh tools/wt/test/*.sh .claude/**/*.sh)
((${#files[@]})) || exit 0
exec pnpm exec shellcheck -x "${files[@]}"
