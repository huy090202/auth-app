#!/usr/bin/env bash
# Hermetic end-to-end test for tools/wt. Everything happens inside a temp dir.
set -euo pipefail

wt="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
repo="$(cd "$wt/../.." && pwd)"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

export CLAUDE_PROJECTS_DIR="$tmp/claude-projects"
export WT_GATE=true
export GIT_AUTHOR_NAME=e2e GIT_AUTHOR_EMAIL=e2e@example.com
export GIT_COMMITTER_NAME=e2e GIT_COMMITTER_EMAIL=e2e@example.com
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null
export HOME="$tmp/home"
mkdir -p "$HOME"

fail=0
ok() { echo "ok - $1"; }
nok() { echo "not ok - $1"; fail=1; }
assert() {
  local msg="$1"
  shift
  if "$@" >/dev/null 2>&1; then ok "$msg"; else nok "$msg"; fi
}

refute() {
  local msg="$1"
  shift
  if "$@" >/dev/null 2>&1; then nok "$msg"; else ok "$msg"; fi
}

# --- Seeding: a throwaway remote whose main carries the tools under test ---
seed_remote() {
  local seed="$tmp/seed"
  git init -q -b main "$seed"
  mkdir -p "$seed/tools" "$seed/docs/infra"
  cp -R "$repo/tools/wt" "$seed/tools/wt"
  rm -rf "$seed/tools/wt/test"
  [ -d "$repo/docs/infra/templates" ] && cp -R "$repo/docs/infra/templates" "$seed/docs/infra/templates"
  [ -d "$repo/.claude" ] && cp -R "$repo/.claude" "$seed/.claude"
  [ -f "$repo/.gitignore" ] && cp "$repo/.gitignore" "$seed/.gitignore"
  echo '{"name":"e2e","private":true}' >"$seed/package.json"
  git -C "$seed" add -A
  git -C "$seed" commit -q -m "chore: seed"
  git init -q --bare -b main "$tmp/remote.git"
  git -C "$seed" push -q "$tmp/remote.git" main
}
seed_remote

# --- lib.sh ---
# shellcheck source=../lib.sh
# shellcheck source-path=SCRIPTDIR
. "$wt/lib.sh"
assert "dir_of maps slash to dash" test "$(dir_of feat/x)" = "feat-x"
assert "key_of replaces non-alphanumerics" test "$(key_of /a/b.c)" = "-a-b-c"

# --- init.sh ---
"$wt/init.sh" "$tmp/remote.git" "$tmp/ws" >/dev/null
assert "init: bare repo" test -f "$tmp/ws/.bare/HEAD"
assert "init: wt_root from a subfolder" test "$(cd "$tmp/ws/main" && wt_root)" = "$tmp/ws"
assert "init: .git pointer" grep -qx 'gitdir: ./.bare' "$tmp/ws/.git"
assert "init: main worktree" test "$(git -C "$tmp/ws/main" branch --show-current)" = main
assert "init: orchestrator orphan" test "$(git -C "$tmp/ws/orchestrator" rev-list --count HEAD)" = 1
assert "init: orchestrator board" test -f "$tmp/ws/orchestrator/BOARD.md"
assert "init: orchestrator gitignore" grep -qx '/local' "$tmp/ws/orchestrator/.gitignore"
assert "init: local symlinks" test -L "$tmp/ws/main/local" -a -L "$tmp/ws/orchestrator/local"
assert "init: .bare/claude link" test "$(readlink "$tmp/ws/.bare/claude")" = "$CLAUDE_PROJECTS_DIR/$(cd "$tmp/ws" && bare_key)"
bk="$CLAUDE_PROJECTS_DIR/$(cd "$tmp/ws" && bare_key)"
assert "init: main claude key linked" test "$(readlink "$CLAUDE_PROJECTS_DIR/$(key_of "$tmp/ws/main")")" = "$bk"
assert "init: orchestrator claude key linked" test "$(readlink "$CLAUDE_PROJECTS_DIR/$(key_of "$tmp/ws/orchestrator")")" = "$bk"
refute "init: idempotent refusal" "$wt/init.sh" "$tmp/remote.git" "$tmp/ws"

# Run a command from inside the main worktree (stdout kept, stderr hidden).
inmain() { (cd "$tmp/ws/main" && "$@" 2>"$tmp/inmain.err"); }

# --- new.sh ---
inmain ./tools/wt/new.sh feat/x --no-install >/dev/null || nok "new: feat/x creation failed"
assert "new: worktree on branch" test "$(git -C "$tmp/ws/feat-x" branch --show-current)" = feat/x
assert "new: forked from main" test "$(git -C "$tmp/ws/feat-x" rev-parse HEAD)" = "$(git -C "$tmp/ws/main" rev-parse HEAD)"
assert "new: local symlink" test -L "$tmp/ws/feat-x/local"
refute "new: no upstream yet" git -C "$tmp/ws/feat-x" rev-parse --abbrev-ref '@{u}'
before="$(git -C "$tmp/ws/main" worktree list | wc -l)"
refute "new: refuses a branch already checked out" inmain ./tools/wt/new.sh feat/x --no-install
assert "new: worktree list unchanged" test "$(git -C "$tmp/ws/main" worktree list | wc -l)" = "$before"
# git's own rejection: branch checked out under a folder name new.sh would not guess
git -C "$tmp/ws" branch feat/y main
git -C "$tmp/ws" worktree add -q other-dir feat/y
before="$(git -C "$tmp/ws/main" worktree list | wc -l)"
refute "new: git rejects branch checked out elsewhere" inmain ./tools/wt/new.sh feat/y --no-install
assert "new: no feat-y dir created" test ! -e "$tmp/ws/feat-y"
assert "new: worktree count unchanged (elsewhere)" test "$(git -C "$tmp/ws/main" worktree list | wc -l)" = "$before"
git -C "$tmp/ws" worktree remove other-dir
git -C "$tmp/ws" branch -q -D feat/y
leftovers=0
for entry in "$CLAUDE_PROJECTS_DIR"/*; do
  case "${entry##*/}" in
    "$(cd "$tmp/ws" && bare_key)" | "$(key_of "$tmp/ws/main")" | "$(key_of "$tmp/ws/orchestrator")" | "$(key_of "$tmp/ws/feat-x")") ;;
    *) leftovers=$((leftovers + 1)) ;;
  esac
done
assert "new: nothing half-created" test "$leftovers" = 0
inmain ./tools/wt/new.sh feat/pushed --no-install --push >/dev/null || nok "new: feat/pushed creation failed"
assert "new --push: upstream set" test "$(git -C "$tmp/ws/feat-pushed" rev-parse --abbrev-ref '@{u}')" = origin/feat/pushed

# --- claude-link.sh ---
link="$CLAUDE_PROJECTS_DIR/$(key_of "$tmp/ws/feat-x")"
target="$CLAUDE_PROJECTS_DIR/$(cd "$tmp/ws" && bare_key)"
assert "link: created by new.sh" test "$(readlink "$link")" = "$target"
inmain ./tools/wt/claude-link.sh "$tmp/ws/feat-x" >/dev/null || nok "link: rerun failed"
assert "link: idempotent" test "$(readlink "$link")" = "$target"
rm -f "$link"
mkdir -p "$link"
echo x >"$link/old.jsonl"
inmain ./tools/wt/claude-link.sh "$tmp/ws/feat-x" >/dev/null || nok "link: backup run failed"
assert "link: real dir backed up" ls -d "$link".bak-*
assert "link: backup keeps content" test -f "$link".bak-*/old.jsonl
assert "link: now a symlink" test "$(readlink "$link")" = "$target"

# --- merge.sh ---
# main advances after feat/x forked, so merge.sh must really rebase
echo m >"$tmp/ws/main/MAINCHANGE"
git -C "$tmp/ws/main" add MAINCHANGE
git -C "$tmp/ws/main" commit -qm "feat: main moves on"
main_head="$(git -C "$tmp/ws/main" rev-parse HEAD)"
echo change >"$tmp/ws/feat-x/CHANGE"
git -C "$tmp/ws/feat-x" add CHANGE
git -C "$tmp/ws/feat-x" commit -qm "feat: change"
echo dirty >"$tmp/ws/feat-x/DIRTY"
refute "merge: refuses dirty worktree" inmain ./tools/wt/merge.sh feat/x
assert "merge: dirty refusal names the dirty state" grep -q 'uncommitted changes' "$tmp/inmain.err"
assert "merge: main untouched after refusal" test "$(git -C "$tmp/ws/main" rev-parse HEAD)" = "$main_head"
refute "merge: refuses main itself" inmain ./tools/wt/merge.sh main
refute "merge: refuses wrong branch in folder" inmain ./tools/wt/merge.sh feat-x
rm "$tmp/ws/feat-x/DIRTY"
refute "merge: gate failure stops the merge" bash -c "cd '$tmp/ws/main' && WT_GATE=false ./tools/wt/merge.sh feat/x"
assert "merge: main HEAD unchanged after gate failure" test "$(git -C "$tmp/ws/main" rev-parse HEAD)" = "$main_head"
inmain ./tools/wt/merge.sh feat/x >/dev/null || { nok "merge: merge run failed"; cat "$tmp/inmain.err"; }
assert "merge: main is a merge commit of feat/x" test "$(git -C "$tmp/ws/main" rev-parse HEAD^2)" = "$(git -C "$tmp/ws/feat-x" rev-parse HEAD)"
assert "merge: first parent is the old main" test "$(git -C "$tmp/ws/main" rev-parse HEAD^1)" = "$main_head"
assert "merge: main pushed" test "$(git -C "$tmp/ws/main" rev-parse origin/main)" = "$(git -C "$tmp/ws/main" rev-parse HEAD)"
assert "merge: feat-x was rebased onto main" git -C "$tmp/ws/main" merge-base --is-ancestor "$main_head" HEAD
assert "merge: exactly one merge commit" test "$(git -C "$tmp/ws/main" rev-list --merges --count HEAD)" = 1
assert "merge: semi-linear (feature has no merges of its own)" test "$(git -C "$tmp/ws/main" rev-list --merges --count HEAD^1..HEAD^2)" = 0

# --- status.sh ---
echo p >"$tmp/ws/feat-pushed/P"
git -C "$tmp/ws/feat-pushed" add P
git -C "$tmp/ws/feat-pushed" commit -qm "feat: pushed-only change"
out="$(inmain ./tools/wt/status.sh)" || nok "status: run failed"
assert "status: lists worktrees" grep -q 'feat-x' <<<"$out"
# behind 3: the main change, the feat/x commit and the merge commit
assert "status: shows ahead/behind" grep -q 'feat/pushed: ahead 1, behind 3 (vs main)' <<<"$out"
assert "status: shows board" grep -q '| Worktree |' <<<"$out"

# --- rm.sh ---
# remote branch with a commit not in main must survive a non-force rm
git -C "$tmp/ws" branch feat/z main
git -C "$tmp/ws" push -q origin feat/z
git -C "$tmp/ws" worktree add -q feat-z feat/z
echo z >"$tmp/ws/feat-z/Z"
git -C "$tmp/ws/feat-z" add Z
git -C "$tmp/ws/feat-z" commit -qm "feat: z only on remote"
git -C "$tmp/ws/feat-z" push -q origin feat/z
git -C "$tmp/ws/feat-z" reset -q --hard main # local now merged, remote is ahead
git -C "$tmp/ws" fetch -q origin
inmain ./tools/wt/rm.sh feat/z >/dev/null || nok "rm: feat/z removal failed"
assert "rm: unmerged remote branch kept" git -C "$tmp/ws/main" ls-remote --exit-code --heads origin feat/z
assert "rm: warned about kept remote" grep -q 'origin/feat/z' "$tmp/inmain.err"
inmain ./tools/wt/new.sh feat/q --no-install >/dev/null || nok "rm: feat/q setup failed"
echo keep >"$tmp/ws/feat-q/KEEP"
refute "rm: refuses folder holding a different branch" inmain ./tools/wt/rm.sh feat-q --force
assert "rm: wrong-branch folder intact" test -f "$tmp/ws/feat-q/KEEP" -a "$(git -C "$tmp/ws/feat-q" branch --show-current)" = feat/q
refute "rm: nonexistent branch errors clearly" inmain ./tools/wt/rm.sh feat/nope
assert "rm: nonexistent branch message" grep -q 'no such branch' "$tmp/inmain.err"
refute "rm: refuses unmerged without --force" inmain ./tools/wt/rm.sh feat/pushed
assert "rm: unmerged still there" test -d "$tmp/ws/feat-pushed"
inmain ./tools/wt/rm.sh feat/x >/dev/null || nok "rm: feat/x removal failed"
assert "rm: worktree gone" test ! -e "$tmp/ws/feat-x"
refute "rm: local branch gone" git -C "$tmp/ws/main" show-ref --verify --quiet refs/heads/feat/x
assert "rm: claude link gone" test ! -e "$CLAUDE_PROJECTS_DIR/$(key_of "$tmp/ws/feat-x")" -a ! -L "$CLAUDE_PROJECTS_DIR/$(key_of "$tmp/ws/feat-x")"
# a branch pushed before merge.sh rebased it must still go without --force
inmain ./tools/wt/new.sh feat/r --no-install --push >/dev/null || nok "rm: feat/r setup failed"
echo r >"$tmp/ws/feat-r/R"
git -C "$tmp/ws/feat-r" add R
git -C "$tmp/ws/feat-r" commit -qm "feat: r"
git -C "$tmp/ws/feat-r" push -q
echo m2 >"$tmp/ws/main/MAINCHANGE2"
git -C "$tmp/ws/main" add MAINCHANGE2
git -C "$tmp/ws/main" commit -qm "feat: main moves on again"
inmain ./tools/wt/merge.sh feat/r >/dev/null || { nok "merge: feat/r merge failed"; cat "$tmp/inmain.err"; }
assert "merge: rebased branch pushed" test "$(git -C "$tmp/ws/main" rev-parse origin/feat/r)" = "$(git -C "$tmp/ws/main" rev-parse HEAD^2)"
inmain ./tools/wt/rm.sh feat/r >/dev/null || { nok "rm: rebased feat/r removal failed"; cat "$tmp/inmain.err"; }
assert "rm rebased: worktree gone" test ! -e "$tmp/ws/feat-r"
refute "rm rebased: local branch gone" git -C "$tmp/ws/main" show-ref --verify --quiet refs/heads/feat/r
refute "rm rebased: remote branch gone" git -C "$tmp/ws/main" ls-remote --exit-code --heads origin feat/r
rm -rf "$tmp/ws/feat-pushed" # deleted by hand, stale metadata remains
inmain ./tools/wt/rm.sh feat/pushed --force >/dev/null || nok "rm --force: run failed"
refute "rm --force: stale worktree pruned" bash -c "git -C '$tmp/ws/main' worktree list | grep -q feat-pushed"
refute "rm --force: remote branch gone" git -C "$tmp/ws/main" ls-remote --exit-code --heads origin feat/pushed

[ "$fail" = 0 ]
