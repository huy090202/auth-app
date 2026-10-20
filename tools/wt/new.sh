#!/usr/bin/env bash
# Create a ready-to-code worktree:
#   new.sh <branch> [--from <branch>] [--no-install] [--push]
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$here/lib.sh"

usage="usage: new.sh <branch> [--from <branch>] [--no-install] [--push]"
branch=""
from="$BASE_BRANCH"
install=1
push=0
while [ $# -gt 0 ]; do
  case "$1" in
    --from)
      [ $# -ge 2 ] || die "$usage"
      from="$2"
      shift 2
      ;;
    --no-install)
      install=0
      shift
      ;;
    --push)
      push=1
      shift
      ;;
    -*) die "unknown option: $1 ($usage)" ;;
    *)
      [ -z "$branch" ] || die "$usage"
      branch="$1"
      shift
      ;;
  esac
done
[ -n "$branch" ] || die "$usage"

# --- preconditions: no side effects before these pass ---
root="$(wt_root)"
dir="$(dir_of "$branch")"
[ -d "$root/$BASE_BRANCH" ] || die "$root/$BASE_BRANCH does not exist (run init.sh first)"
[ ! -e "$root/$dir" ] || die "$root/$dir already exists"

if git -C "$root" remote get-url origin >/dev/null 2>&1; then
  git -C "$root" fetch -q origin || warn "fetch failed; using local knowledge of origin"
fi

if git -C "$root" show-ref --verify -q "refs/heads/$branch"; then
  mode=local
elif git -C "$root" show-ref --verify -q "refs/remotes/origin/$branch"; then
  mode=remote
else
  mode=new
  git -C "$root" show-ref --verify -q "refs/remotes/origin/$from" ||
    die "origin/$from does not exist; push it first"
fi

# --- create ---
step "Creating worktree $dir on $branch ($mode)"
case "$mode" in
  local) git -C "$root" worktree add -q "$dir" "$branch" ;;
  remote) git -C "$root" worktree add -q --track -b "$branch" "$dir" "origin/$branch" ;;
  new) git -C "$root" worktree add -q --no-track -b "$branch" "$dir" "origin/$from" ;;
esac

mkdir -p "$root/local"
ln -s ../local "$root/$dir/local"

if [ "$install" = 1 ]; then
  if [ -f "$root/$dir/package.json" ]; then
    step "Installing dependencies"
    (cd "$root/$dir" && pnpm install)
  else
    warn "no package.json in $dir; skipping install"
  fi
fi

"$here/claude-link.sh" "$root/$dir"

if [ "$push" = 1 ]; then
  step "Pushing $branch"
  git -C "$root/$dir" push -q --set-upstream origin "$branch"
fi

echo "cd $root/$dir && claude"
