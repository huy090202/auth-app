#!/usr/bin/env bash
# Remove a worktree and its branch: rm.sh <branch> [--force]
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$here/lib.sh"

usage="usage: rm.sh <branch> [--force]"
branch=""
force=0
for arg in "$@"; do
  case "$arg" in
    --force) force=1 ;;
    -*) die "unknown option: $arg ($usage)" ;;
    *)
      [ -z "$branch" ] || die "$usage"
      branch="$arg"
      ;;
  esac
done
[ -n "$branch" ] || die "$usage"
[ "$branch" != "$BASE_BRANCH" ] || die "refusing to remove $BASE_BRANCH"

root="$(wt_root)"
dir="$(dir_of "$branch")"
main="$root/$BASE_BRANCH"

git -C "$root" show-ref --verify -q "refs/heads/$branch" ||
  git -C "$root" show-ref --verify -q "refs/remotes/origin/$branch" ||
  [ -e "$root/$dir" ] || die "no such branch: $branch"

if [ -e "$root/$dir" ]; then
  [ "$(git -C "$root/$dir" branch --show-current)" = "$branch" ] ||
    die "$dir does not have $branch checked out"
fi

if [ "$force" = 0 ]; then
  git -C "$main" branch --merged "$BASE_BRANCH" --format='%(refname:short)' | grep -qx "$branch" ||
    die "$branch is not merged into $BASE_BRANCH (use --force to discard it)"
fi

if [ -e "$root/$dir" ]; then
  step "Removing worktree $dir"
  if [ "$force" = 1 ]; then
    git -C "$root" worktree remove --force "$dir"
  else
    git -C "$root" worktree remove "$dir"
  fi
else
  step "Pruning stale worktree metadata"
  git -C "$root" worktree prune
fi

if git -C "$root" show-ref --verify -q "refs/heads/$branch"; then
  step "Deleting local branch $branch"
  if [ "$force" = 1 ]; then
    git -C "$root" branch -q -D "$branch"
  else
    git -C "$root" branch -q -d "$branch"
  fi
fi

if git -C "$root" show-ref --verify -q "refs/remotes/origin/$branch"; then
  if [ "$force" = 1 ] || git -C "$root" merge-base --is-ancestor "origin/$branch" "$BASE_BRANCH"; then
    step "Deleting remote branch origin/$branch"
    git -C "$root" push -q origin --delete "$branch"
  else
    warn "origin/$branch has commits not in $BASE_BRANCH; keeping it (use --force to delete)"
  fi
fi

link="$CLAUDE_PROJECTS_DIR/$(key_of "$root/$dir")"
if [ -L "$link" ]; then
  rm "$link"
elif [ -e "$link" ]; then
  warn "$link is a real directory; leaving it in place"
fi
