# Brief: feat/rate-limited (repository huy090202/auth-app)

## Goal
Bring auth-app in line with two auth-gate changes merged in PR #2 (auth-gate `ce8c443`):

1. Rate limiting: AuthGate can answer `429 {"error":"rate_limited"}` with a whole-second
   `Retry-After`. `bff` reports this as `502 authgate_unavailable`, so users see the wrong
   message.
2. A passkey registration with a `subjectId` over 64 bytes now answers `400 invalid_id`, not
   `500 internal`. The public docs still state the old behaviour.

## Constraints
- Code follows "Task 18" in `docs/superpowers/plans/2026-11-06-console.md` on auth-gate main,
  read only: `mapError` mapping, the three tests, and the `errors.rate_limited` strings.
- Do NOT paste Task 18's docs rows. They predate the integrator docs rewrite: they have an
  `AuthGate | bff | What to show` shape and name `bff`. `errors.md` now has `Status and code |
  What happened | What to do` tables, and public docs must not mention `bff`. Write new rows
  in that shape, documenting AuthGate's contract, in EN and VI.
- Check every API fact against auth-gate source on `origin/main`, read only:
  `internal/auth/handler/limit.go`, `respond.go`, `internal/auth/webauthn/user.go`. Decide from
  the source which calls can answer `429`, and whether `api.md` Conventions must say so.
- Update each stale statement of the 64-byte behaviour, in both languages: `api.md:16-17`,
  `enroll.md:9`, `errors.md:45`. Check the `invalid_id` row at `errors.md:26` too. The advice
  to keep `subjectId` to 64 bytes stays.
- `bff` passes `retryAfter` to the demo only. The docs tell integrators to read `Retry-After`.
- Out of scope, because they are not on stg yet: `rateLimit` client settings, disabled clients
  (Task 5), `DELETE /api/clients/{id}/keys/previous`. Keep `setup` as it is: no named contact,
  no Console link, no promise of sign-up or a date.
- No auth-gate changes. Never run auth-gate locally.

## Definition of done
- `pnpm --filter bff test` shows the three new tests failing first, then passing.
- `pnpm run check` green.
- `grep -rnE '\bbff\b|bff/|app/src|scripts/' docs/en docs/vi` prints nothing.
- `grep -rn '500 internal' docs/en docs/vi` shows only the generic server-error statements.
- Branch pushed, and the human reminded to open the PR. Do not run `merge.sh` unless asked.
- After merge and deploy, HUMAN does Task 18 Step 6: `PATCH` the `auth-app-stg` client to
  `{burst: 1, perSecond: 0.05}`, trigger two PIN calls in the demo in both languages, see the
  message, and `PATCH` back to `{burst: 100, perSecond: 50}`. Restoring the limit is required.
  List this under "Remaining" until the human confirms it.

## References
- Plan: auth-gate `origin/main:docs/superpowers/plans/2026-11-06-console.md`, Task 18
- Code: `bff/src/authgate/client.ts` (`mapError`), `app/src/app/strings.ts`
- Docs: `docs/{en,vi}/errors.md`, `api.md`, `enroll.md`
