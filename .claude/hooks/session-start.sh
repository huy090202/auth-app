#!/usr/bin/env bash
# SessionStart hook: inject the BOARD row and latest handoff. Always exits 0.
set -euo pipefail

main() {
  local cwd dir orch branch row f c
  cwd="$(jq -r '.cwd // empty' 2>/dev/null)" || return 0
  [ -n "$cwd" ] || cwd="$PWD"
  dir="$(basename "$cwd")"
  orch="$cwd/../orchestrator"
  if [ ! -d "$orch" ]; then
    echo "Orchestrator worktree not found at ../orchestrator."
    return 0
  fi
  branch="$(git -C "$cwd" branch --show-current 2>/dev/null || true)"
  if [ "$branch" = "orchestrator" ]; then
    head -n 200 "$orch/BOARD.md" 2>/dev/null || echo "No BOARD.md found."
    dir="orchestrator"
  else
    row="$(awk -F'|' -v d="$dir" '{ x = $2; gsub(/^ +| +$/, "", x); if (x == d) { print; exit } }' "$orch/BOARD.md" 2>/dev/null || true)"
    if [ -n "$row" ]; then
      echo "$row"
    else
      echo "No BOARD row for $dir. Ask the orchestrator session for an assignment."
    fi
  fi
  f=""
  for c in "$orch/handoffs/$dir"/*.md; do
    [ -f "$c" ] && f="$c" # glob expands sorted, so the last match is the newest
  done
  if [ -n "$f" ]; then
    echo "--- latest handoff: $(basename "$f") ---"
    head -n 120 "$f"
  else
    echo "No handoff yet."
  fi
  echo "More: docs/infra/00-overview.md"
}

main 2>/dev/null || true
exit 0
