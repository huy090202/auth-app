#!/usr/bin/env bash
# shellcheck disable=SC2016
# Hermetic test for the .claude statusline and hooks.
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
dotclaude="$repo/.claude"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

export CLAUDE_CTX_DIR="$tmp/ctx"
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null

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

# --- Fixture ---
mkdir -p "$tmp/ws/orchestrator/handoffs/feat-x"
cat >"$tmp/ws/orchestrator/BOARD.md" <<'BOARD'
# Board

| Worktree | Branch | Task | Status | Last handoff | Notes |
|---|---|---|---|---|---|
| feat-x | feat/x | X thing | active | 00-brief | |
BOARD
echo BRIEF-MARKER >"$tmp/ws/orchestrator/handoffs/feat-x/00-brief.md"
git init -q "$tmp/ws/feat-x"
git -C "$tmp/ws/feat-x" checkout -q -b feat/x
git init -q "$tmp/ws/feat-none"
git -C "$tmp/ws/feat-none" checkout -q -b feat/none

guard() { echo '{"session_id":"t1"}' | bash "$dotclaude/hooks/context-guard.sh"; }

out="$(printf '{"session_id":"t1","workspace":{"current_dir":"%s"},"context_window":{"used_percentage":42.7},"cost":{"total_cost_usd":0.123}}' "$tmp/ws/feat-x" | bash "$dotclaude/statusline.sh")"
assert "statusline: text" test "$out" = 'feat/x | ctx 42% | $0.12'
out="$(echo '{"session_id":"t2","cost":{"total_cost_usd":"abc"},"context_window":{"used_percentage":null}}' | bash "$dotclaude/statusline.sh")"
assert "statusline: null/bad fields" grep -qF 'ctx 0% | $0.00' <<<"$out"
out="$(echo '{}' | bash "$dotclaude/statusline.sh")"
assert "statusline: empty object" grep -q 'ctx 0%' <<<"$out"
echo '{"session_id":"../x","context_window":{"used_percentage":9}}' | bash "$dotclaude/statusline.sh" >/dev/null
assert "statusline: traversal id stays inside ctx dir" test -f "$tmp/ctx/___x"
refute "statusline: traversal id wrote nothing outside" test -e "$tmp/x"
assert "statusline: file" test "$(cat "$tmp/ctx/t1")" = 42
assert "guard: silent below 70" test -z "$(guard)"
refute "guard: no warning below 70" grep -q 'context-guard' <<<"$(guard)"
echo 70 >"$tmp/ctx/t1"
assert "guard: warns at 70" grep -q 'run /handoff' <<<"$(guard)"
echo 85 >"$tmp/ctx/t1"
assert "guard: stops at 85" grep -q 'STOP' <<<"$(guard)"
assert "guard: no file is silent" test -z "$(echo '{"session_id":"nope"}' | bash "$dotclaude/hooks/context-guard.sh")"
assert "guard: garbage input exits 0" sh -c "echo garbage | bash '$dotclaude/hooks/context-guard.sh' >/dev/null"
out="$(printf '{"cwd":"%s"}' "$tmp/ws/feat-x" | bash "$dotclaude/hooks/session-start.sh")"
assert "start: board row" grep -q '| feat-x |' <<<"$out"
assert "start: latest handoff" grep -q 'BRIEF-MARKER' <<<"$out"
out="$(printf '{"cwd":"%s"}' "$tmp/ws/feat-none" | bash "$dotclaude/hooks/session-start.sh")"
assert "start: no row message" grep -q 'No BOARD row for feat-none' <<<"$out"
assert "start: no handoff message" grep -q 'No handoff yet' <<<"$out"
assert "start: missing orchestrator exits 0" sh -c "printf '{\"cwd\":\"$tmp/nowhere\"}' | bash '$dotclaude/hooks/session-start.sh' >/dev/null"
git init -q "$tmp/ws/orchestrator"
git -C "$tmp/ws/orchestrator" checkout -q -b orchestrator
out="$(printf '{"cwd":"%s"}' "$tmp/ws/orchestrator" | bash "$dotclaude/hooks/session-start.sh")"
assert "start: orchestrator prints whole board" grep -q '^# Board' <<<"$out"
assert "start: orchestrator no handoff yet" grep -q 'No handoff yet' <<<"$out"
mkdir -p "$tmp/ws/orchestrator/handoffs/orchestrator"
echo ORCH-OLD >"$tmp/ws/orchestrator/handoffs/orchestrator/2026-01-01-0000.md"
echo ORCH-NEW >"$tmp/ws/orchestrator/handoffs/orchestrator/2026-02-01-0000.md"
out="$(printf '{"cwd":"%s"}' "$tmp/ws/orchestrator" | bash "$dotclaude/hooks/session-start.sh")"
assert "start: orchestrator prints newest handoff" grep -q 'ORCH-NEW' <<<"$out"
refute "start: orchestrator skips older handoff" grep -q 'ORCH-OLD' <<<"$out"
for i in $(seq 1 250); do echo "row-$i"; done >>"$tmp/ws/orchestrator/BOARD.md"
out="$(printf '{"cwd":"%s"}' "$tmp/ws/orchestrator" | bash "$dotclaude/hooks/session-start.sh")"
assert "start: board capped at 200 lines" grep -q '^row-190$' <<<"$out"
refute "start: board cap cuts the rest" grep -q '^row-250$' <<<"$out"

exit "$fail"
