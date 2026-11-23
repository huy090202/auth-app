#!/usr/bin/env bash
# Run shellcheck over every tracked shell script that exists (globs may match nothing yet).
set -euo pipefail
cd "$(dirname "$0")/.."

# Pin ShellCheck. The npm wrapper (4.1.0) ignores SHELLCHECKJS_RELEASE when it downloads, and
# asks api.github.com for "latest", which rate-limits CI. So on Linux fetch the pinned release
# straight from releases/download (no API call) into node_modules/.cache, and hand it to the
# wrapper as SHELLCHECKJS_BIN. Elsewhere the wrapper downloads as before.
SHELLCHECK_RELEASE=v0.11.0
export SHELLCHECKJS_RELEASE="$SHELLCHECK_RELEASE"
if [[ "$(uname -s)" == Linux && -z "${SHELLCHECKJS_BIN:-}" ]]; then
  case "$(uname -m)" in x86_64 | aarch64) arch="$(uname -m)" ;; *) arch="" ;; esac
  if [[ -n "$arch" ]]; then
    cache="node_modules/.cache/shellcheck-$SHELLCHECK_RELEASE"
    if [[ ! -x "$cache/shellcheck" ]]; then
      mkdir -p "$cache"
      echo "downloading shellcheck $SHELLCHECK_RELEASE ($arch)" >&2
      curl -fsSL "https://github.com/koalaman/shellcheck/releases/download/$SHELLCHECK_RELEASE/shellcheck-$SHELLCHECK_RELEASE.linux.$arch.tar.xz" |
        tar -xJ -C "$cache" --strip-components=1 "shellcheck-$SHELLCHECK_RELEASE/shellcheck"
    fi
    export SHELLCHECKJS_BIN="$PWD/$cache/shellcheck"
  fi
fi

shopt -s nullglob globstar
files=(tools/lint-shell.sh scripts/setup-and-deploy/*.sh scripts/setup-and-deploy/test/*.sh tools/wt/*.sh tools/wt/test/*.sh .claude/**/*.sh)
((${#files[@]})) || exit 0
exec pnpm exec shellcheck -x "${files[@]}"
