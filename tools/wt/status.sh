#!/usr/bin/env bash
# Overview of worktrees, drift from main, and the orchestrator board.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$here/lib.sh"

root="$(wt_root)"

git -C "$root" worktree list
echo

while read -r branch; do
  [ "$branch" != "$BASE_BRANCH" ] || continue
  read -r behind ahead < <(git -C "$root" rev-list --left-right --count "$BASE_BRANCH...$branch")
  echo "  $branch: ahead $ahead, behind $behind (vs $BASE_BRANCH)"
done < <(git -C "$root" for-each-ref --format='%(refname:short)' refs/heads)

if [ -f "$root/orchestrator/BOARD.md" ]; then
  echo
  grep '^|' "$root/orchestrator/BOARD.md" || true
fi

if [ -d "$root/orchestrator/.claude" ] && [ -d "$root/$BASE_BRANCH/.claude" ] &&
  ! diff -rq "$root/orchestrator/.claude" "$root/$BASE_BRANCH/.claude" >/dev/null; then
  warn "orchestrator/.claude differs from main/.claude"
fi
