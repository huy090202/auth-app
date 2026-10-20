#!/usr/bin/env bash
# Rebase a feature branch on main, run the gate, then merge it with a merge commit
# (semi-linear history: each feature is a straight run of commits closed by one merge):
#   merge.sh <branch> [--no-push]
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$here/lib.sh"

usage="usage: merge.sh <branch> [--no-push]"
branch=""
push=1
for arg in "$@"; do
  case "$arg" in
    --no-push) push=0 ;;
    -*) die "unknown option: $arg ($usage)" ;;
    *)
      [ -z "$branch" ] || die "$usage"
      branch="$arg"
      ;;
  esac
done
[ -n "$branch" ] || die "$usage"
[ "$branch" != "$BASE_BRANCH" ] || die "refusing to merge $BASE_BRANCH into itself"

root="$(wt_root)"
dir="$(dir_of "$branch")"
main="$root/$BASE_BRANCH"
gate="${WT_GATE:-pnpm run check}"
[ -d "$root/$dir" ] || die "no worktree at $root/$dir"
[ -d "$main" ] || die "no worktree at $main"
[ "$(git -C "$root/$dir" branch --show-current)" = "$branch" ] ||
  die "$dir does not have $branch checked out"

step "Checking worktrees are clean"
[ -z "$(git -C "$root/$dir" status --porcelain)" ] || die "$dir has uncommitted changes"
[ -z "$(git -C "$main" status --porcelain)" ] || die "$BASE_BRANCH has uncommitted changes"

if git -C "$root" remote get-url origin >/dev/null 2>&1; then
  step "Fetching origin"
  git -C "$root" fetch -q origin
fi
if git -C "$main" rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  step "Updating $BASE_BRANCH"
  git -C "$main" pull -q --ff-only
fi

step "Rebasing $branch onto $BASE_BRANCH"
git -C "$root/$dir" rebase "$BASE_BRANCH" ||
  die "rebase conflict: resolve it in $root/$dir and re-run, or run: git -C $root/$dir rebase --abort"

step "Running gate: $gate"
(cd "$root/$dir" && eval "$gate")

# Push the rebased branch first, so origin/<branch> is what gets merged and rm.sh can
# later delete it without --force. The lease fails if someone pushed since our fetch.
if [ "$push" = 1 ] && git -C "$root" show-ref --verify -q "refs/remotes/origin/$branch"; then
  step "Pushing rebased $branch"
  lease="$(git -C "$root" rev-parse "refs/remotes/origin/$branch")"
  git -C "$root/$dir" push -q --force-with-lease="$branch:$lease" origin "$branch" ||
    die "push of rebased $branch rejected: origin/$branch moved since the fetch; $BASE_BRANCH not merged"
fi

step "Merging $branch into $BASE_BRANCH"
git -C "$main" merge -q --no-ff -m "Merge branch '$branch'" "$branch"

if [ "$push" = 1 ]; then
  step "Pushing $BASE_BRANCH"
  git -C "$main" push -q origin "$BASE_BRANCH"
else
  warn "--no-push: $BASE_BRANCH not pushed"
fi
