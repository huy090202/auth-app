# Brief: feat/integrator-docs (repository huy090202/auth-app)

## Goal
Rewrite the `/docs/*` pages (EN and VI) for an outside team integrating AuthGate into their
own system. Today the pages explain how this repo's demo is built. A reader who has never
seen this repo must be able to answer, from the docs alone:

1. What does AuthGate provide, and what does it leave to me?
2. What do I have to do to integrate it, in what order?
3. How do my system and AuthGate interact in each flow?

## The problem, with evidence
All 16 pages mention internals (31 matching lines for `bff`, `bff/`, `app/src`, `scripts/`):
- `setup` tells the reader to run `scripts/setup-and-deploy/02-register-client.sh`.
- `2fa-login`, `enroll`, `passkey-login` and `verify-token` cite this repo's source paths
  and paste its code, including app-specific helpers such as `issueSession` and
  `c.var.trace`.
- `errors` is organised around how `bff` remaps statuses, so the reader can mistake demo
  behaviour for the AuthGate API, and it links to the demo's `/app/security`.
- No page lists what the integrator must build, and there is no endpoint reference.

## Constraints
- Docs content first. Touch `app/` only where the page structure requires it (for example
  `slugs` in `app/src/docs/loader.ts` and redirects to `/docs/what-it-is`). No demo, `bff`
  or auth-gate changes.
- Public docs describe AuthGate's contract and the integrator's work. No repo paths, no
  repo scripts, no `bff`, no demo internals. Say "your backend". The demo may appear only
  as an optional "Try it" and is never required reading.
- Code samples stay short and framework-neutral, and must run outside this repo. Keep the
  token verification sample, since integrators need it. Fetch, WebAuthn and JOSE are fine.
- Every API fact must be checked against auth-gate, not copied from the current pages:
  `/home/work/auth-gate/main/README.md` and `/home/work/auth-gate/main/bruno/` (read only).
- EN and VI have the same file names and the same structure. VI keeps the natural developer
  voice of the 2026-11-06 rewrite. Keep the existing concise tone.
- The page list is the worker's to propose. Agree it with the human before rewriting all
  pages. It should cover: what you get, integration checklist, flows, token verification,
  API and error reference.
- Changing the page list changes a requirement, so updating the eight-slug test in
  `app/src/docs/loader.test.ts` and spec §5.3 is expected. Say so in the commit.
- Out of scope: the `rate_limited` follow-up, which waits for the AuthGate limiter on stg.

## Open question for the human (ask before writing the setup page)
How does an outside team get a `clientId` and `accessKey`? The current page has them call
`POST /api/clients` with the admin key. Decide whether outsiders self-register with that
key or the AuthGate operator issues credentials after they send `rpId` and `origins`.

## Definition of done
- `grep -rnE '\bbff\b|bff/|app/src|scripts/' docs/en docs/vi` prints nothing.
- Both languages have the same slugs, and the three goal questions are each answered by a
  named page, listed in the handoff.
- Every endpoint, field, status and error code in the docs was checked against auth-gate.
- `pnpm run check` green; pages reviewed in a browser in both languages.
- Branch pushed, and the human reminded to open the PR. Do not run `merge.sh` unless asked.
- Handoff written with an empty "Remaining".

## References
- Current pages: `docs/en/*.md`, `docs/vi/*.md`
- Spec §5.3: `docs/superpowers/specs/2026-10-20-auth-app-design.md`
- Previous handoff: `orchestrator:handoffs/feat-auth-app/2026-11-06-1729.md`
