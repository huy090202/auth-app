#!/usr/bin/env bash
# Point a worktree's Claude project dir at the shared .bare key:
#   claude-link.sh <worktree-dir>
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$here/lib.sh"

[ $# -eq 1 ] || die "usage: claude-link.sh <worktree-dir>"
[ -d "$1" ] || die "no such directory: $1"
abs="$(cd "$1" && pwd -P)"

link="$CLAUDE_PROJECTS_DIR/$(key_of "$abs")"
target="$CLAUDE_PROJECTS_DIR/$(bare_key)"

mkdir -p "$CLAUDE_PROJECTS_DIR" "$target"

if [ -L "$link" ]; then
  [ "$(readlink "$link")" != "$target" ] || exit 0
  rm "$link"
elif [ -d "$link" ]; then
  if [ -z "$(ls -A "$link")" ]; then
    rmdir "$link"
  else
    backup="$link.bak-$(date +%Y%m%d-%H%M%S)"
    n=0
    while [ -e "$backup" ]; do
      n=$((n + 1))
      backup="$link.bak-$(date +%Y%m%d-%H%M%S)-$n"
    done
    warn "existing Claude data moved to $backup"
    mv "$link" "$backup"
  fi
elif [ -e "$link" ]; then
  die "$link exists and is not a directory or symlink"
fi

ln -s "$target" "$link"
step "Linked $link -> $target"
