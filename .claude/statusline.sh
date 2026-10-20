#!/usr/bin/env bash
# Statusline: "<branch> | ctx <N>% | $<cost>"; also records N for the context guard.
set -euo pipefail

ctx_dir="${CLAUDE_CTX_DIR:-/tmp/claude-ctx}"
mkdir -p "$ctx_dir" 2>/dev/null || true

input="$(cat)"
session="$(jq -r '.session_id // "unknown"' <<<"$input" 2>/dev/null || echo unknown)"
dir="$(jq -r '.workspace.current_dir // "."' <<<"$input" 2>/dev/null || echo .)"
pct="$(jq -r '((.context_window.used_percentage | tonumber?) // 0) | floor' <<<"$input" 2>/dev/null || echo 0)"
cost="$(jq -r '(.cost.total_cost_usd | tonumber?) // 0' <<<"$input" 2>/dev/null || echo 0)"

branch="$(git -C "$dir" branch --show-current 2>/dev/null || true)"
[ -n "$branch" ] || branch="-"

session="${session//[^A-Za-z0-9_-]/_}"
{ echo "$pct" >"$ctx_dir/$session"; } 2>/dev/null || true

LC_ALL=C printf '%s | ctx %s%% | $%.2f\n' "$branch" "$pct" "$cost"
