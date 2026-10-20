#!/usr/bin/env bash
# Shared helpers for tools/wt scripts. Source this file; do not execute it.
set -euo pipefail

export BASE_BRANCH=main
CLAUDE_PROJECTS_DIR="${CLAUDE_PROJECTS_DIR:-$HOME/.claude/projects}"
export CLAUDE_PROJECTS_DIR

die() {
  printf '\033[31merror:\033[0m %s\n' "$*" >&2
  exit 1
}
warn() { printf '\033[33mwarn:\033[0m %s\n' "$*" >&2; }
step() { printf '\033[36m==>\033[0m %s\n' "$*"; }

# Echo the nearest ancestor directory containing .bare. Walks up from $PWD,
# then from the directory of the sourcing script (works through local/ symlinks).
wt_root() {
  local start dir
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]:-$0}")" 2>/dev/null && pwd -P)" || script_dir=""
  for start in "$PWD" "$script_dir"; do
    [ -n "$start" ] || continue
    dir="$start"
    while [ "$dir" != "/" ]; do
      if [ -e "$dir/.bare" ]; then
        printf '%s\n' "$dir"
        return 0
      fi
      dir="$(dirname "$dir")"
    done
  done
  die "not inside a bare-repo workspace (no .bare found)"
}

# Branch name to directory name: feat/x -> feat-x.
dir_of() { printf '%s\n' "${1//\//-}"; }

# Absolute path to Claude project key: every non-alphanumeric becomes '-'.
key_of() { printf '%s\n' "${1//[^A-Za-z0-9]/-}"; }

bare_key() {
  local root
  root="$(wt_root)"
  key_of "$root/.bare"
}
