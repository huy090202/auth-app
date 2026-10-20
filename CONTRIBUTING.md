# Contributing

## Setup

- Node 22
- pnpm 10.13.1 (`corepack enable` picks it from `package.json`)
- `pnpm install` at the repository root

Code, comments, docs and commit messages are in English. Commits use Conventional
Commits (`feat(bff): ...`, `docs: ...`).

## Check before you finish

```bash
pnpm run check
```

It runs lint (shellcheck and package lint), typecheck, tests (shell tests for the
worktree tools, then `bff` and `app`) and build. It must pass before you open a PR.

## Tests

Tests are few on purpose. Each one guards something readers copy or a security
boundary:

- `bff/test/token.test.ts` - token verification. Readers copy this code; a bug here is a hole on their side.
- `bff/test/session.test.ts` - an `mfa=false` cookie cannot reach an `mfa=true` route. This is the only 2FA gate.
- `bff/test/trace.test.ts` - secrets (pin, credential, token, access key) never appear in trace output. Trace is on in a public stage.
- `app/test/webauthn.test.ts` - base64url and ArrayBuffer round trip on real fixtures. Encoding is the most common WebAuthn bug.

`bff` uses `node --test`; `app` uses vitest. Relay routes that only pass data to
auth-gate have no unit tests: the Bruno collection in `bruno/` and `scripts/setup-and-deploy/04-smoke.sh`
cover them. Add a test only when it protects one of these two kinds of code.
