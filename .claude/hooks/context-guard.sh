#!/usr/bin/env bash
# UserPromptSubmit hook: warn Claude when context usage is high. Always exits 0.
set -euo pipefail
WARN=70
STOP=85

main() {
  local ctx_dir="${CLAUDE_CTX_DIR:-/tmp/claude-ctx}"
  local session pct
  session="$(jq -r '.session_id // empty' 2>/dev/null)" || return 0
  session="${session//[^A-Za-z0-9_-]/_}"
  [ -n "$session" ] || return 0
  [ -r "$ctx_dir/$session" ] || return 0
  pct="$(head -n1 "$ctx_dir/$session" 2>/dev/null)" || return 0
  case "$pct" in '' | *[!0-9]*) return 0 ;; esac
  if [ "$pct" -ge "$STOP" ]; then
    echo "[context-guard] Context is at ${pct}%. STOP. Write the handoff now with /handoff and print the command to start a new session. Do not start new work."
  elif [ "$pct" -ge "$WARN" ]; then
    echo "[context-guard] Context is at ${pct}%. Finish the current step, then run /handoff and tell the user to start a new session."
  fi
}

main 2>/dev/null || true
exit 0
