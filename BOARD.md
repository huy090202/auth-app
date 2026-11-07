# Board

| Worktree | Branch | Task | Status | Last handoff | Notes |
|---|---|---|---|---|---|
| feat-auth-app | feat/auth-app | auth-app v1: integration docs (EN/VI) + sample client (password, PIN, passkey) | merged | 2026-11-06-1729 | stg: https://d3d49hg6rb8ylx.cloudfront.net |
| feat-integrator-docs | feat/integrator-docs | Rewrite /docs (EN/VI) for outside integrators: what it provides, what to do, flows; remove repo internals | merged | 2026-11-06-1929 | PR #1 merged to main (753639b); worktree and branch removed; stg serves the new docs |
| feat-rate-limited | feat/rate-limited | Map AuthGate 429 rate_limited in bff and demo; update docs for 429 and the passkey subjectId 400 | merged | 2026-11-06-2034 | PR #2 merged (ef95f5f); stg deployed; Task 18 Step 6 confirmed by Huy 2026-11-06, limit restored to 100/50; worktree and branch removed |
| feat-operator-key-remedies | feat/operator-key-remedies | Docs: what the operator can do about a leaked key (end previous key's grace, disable client) | merged | | PR #3 merged (e3bdb01); stg deployed, bundle checked; worktree and branch removed |
| feat-toc-active-heading | feat/toc-active-heading | Fix docs TOC: highlight the section you jumped to or scrolled to | merged | | PR #4 merged (f40adb1); stg deployed, TOC check green on stg; worktree and branch removed |
| feat-session-transient-error | feat/session-transient-error | Demo: stop treating a failed session refresh (429, 502) as signed out | merged | 2026-11-06-2200 | PR #5 merged (88a785a); stg deployed, check with /api mocked green on stg; worktree and branch removed |
| feat-register-key-argv | feat/register-key-argv | Stop 02-register-client.sh putting the client key on jq argv | planned | 00-brief.md | |

Status values: planned, active, review, merged, abandoned.
