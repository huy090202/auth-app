# auth-app

auth-app is the integration docs for auth-gate (EN/VI) and the sample client that proves
them, served as one site: a React SPA (`app/`, routes `/docs/*` and `/app/*`) and a Hono
backend (`bff/`) on Lambda, behind one CloudFront URL. The browser only calls same-origin
`/api`; only `bff` talks to auth-gate.

## Rules

- Code, comments, docs and commit messages are in English.
- If `local/rules.md` exists, read it. It takes precedence over this file.
- Commit only when asked. Use Conventional Commits.
- Never push `main` directly. `tools/wt/merge.sh` does that, after the gate passes.
- `pnpm run check` (lint, shell tests, and the app/bff gates once they exist) must pass before you call work done.

## Workspace layout

- The workspace root holds `.bare/` (the git repository) and one folder per worktree.
- `main/` is branch `main`; each feature is `feat-<name>/` on branch `feat/<name>`.
- `orchestrator/` is an orphan branch holding `BOARD.md` and `handoffs/`. Read it via `../orchestrator/`.
- `local/` is a symlink to `../local`: private, gitignored notes and secrets.
- Details: `docs/infra/00-overview.md`.

## Session continuity

- Your BOARD row and latest handoff were injected at session start. If they were not,
  read `../orchestrator/BOARD.md` and the newest file in `../orchestrator/handoffs/<dir>/`.
- Run `/handoff` before you stop, and as soon as the context guard warns you.
