#!/usr/bin/env bash
# Bootstrap a bare-repo workspace: init.sh <repo-url> [<dir>]
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=lib.sh
# shellcheck source-path=SCRIPTDIR
. "$here/lib.sh"

[ $# -ge 1 ] || die "usage: init.sh <repo-url> [<dir>]"
url="$1"
dir="${2:-$(basename "${url%.git}")}"

[ ! -e "$dir/.bare" ] || die "$dir/.bare already exists"
mkdir -p "$dir"
dir="$(cd "$dir" && pwd -P)"

step "Cloning $url into $dir/.bare"
git clone --bare -q "$url" "$dir/.bare"
echo "gitdir: ./.bare" >"$dir/.git"
git -C "$dir" config remote.origin.fetch '+refs/heads/*:refs/remotes/origin/*'
git -C "$dir" fetch -q origin

step "Creating main worktree"
git -C "$dir" show-ref --verify -q "refs/heads/$BASE_BRANCH" || die "remote has no $BASE_BRANCH branch"
git -C "$dir" worktree add -q main "$BASE_BRANCH"

step "Creating orchestrator worktree"
orch_new=0
if git -C "$dir" show-ref --verify -q refs/heads/orchestrator ||
  git -C "$dir" show-ref --verify -q refs/remotes/origin/orchestrator; then
  if git -C "$dir" show-ref --verify -q refs/heads/orchestrator; then
    git -C "$dir" worktree add -q orchestrator orchestrator
  else
    git -C "$dir" worktree add -q --track -b orchestrator orchestrator origin/orchestrator
  fi
else
  orch_new=1
  git -C "$dir" worktree add -q --detach orchestrator "$BASE_BRANCH"
  (
    cd "$dir/orchestrator"
    git checkout -q --orphan orchestrator
    git rm -rfq .
    cp -R "$dir/main/docs/infra/templates/orchestrator/." .
    [ -d "$dir/main/.claude" ] && cp -R "$dir/main/.claude" .claude
    git add -A
    git commit -q -m "chore: bootstrap orchestrator branch"
  )
fi

step "Linking shared folders"
mkdir -p "$dir/local"
ln -s ../local "$dir/main/local"
ln -s ../local "$dir/orchestrator/local"

key="$(cd "$dir" && bare_key)"
mkdir -p "$CLAUDE_PROJECTS_DIR/$key"
ln -sfn "$CLAUDE_PROJECTS_DIR/$key" "$dir/.bare/claude"

step "Linking Claude data"
(
  cd "$dir"
  "$here/claude-link.sh" "$dir/main"
  "$here/claude-link.sh" "$dir/orchestrator"
)

step "Done: $dir"
[ "$orch_new" = 0 ] || echo "Next: git -C $dir/orchestrator push -u origin orchestrator"
echo "Next: cd $dir/main && pnpm install"
