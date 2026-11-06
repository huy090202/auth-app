#!/usr/bin/env bash
# Build every package, then check the two artifacts the deploy needs.
set -euo pipefail
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

(cd "$ROOT" && pnpm -r build)
for f in bff/dist/index.mjs app/dist/index.html; do
  [[ -f "$ROOT/$f" ]] || die "$f missing after build"
done
echo "built bff/dist and app/dist"
