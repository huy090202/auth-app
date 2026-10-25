# auth-app

Integration docs for auth-gate (English and Vietnamese) plus a sample client that
proves them. Both are one site: a React SPA and a small Hono backend (`bff`) on Lambda,
behind one CloudFront URL. The docs have "Try it" links that open the matching demo
screen and show the trace of the auth-gate calls.

The stg site URL is printed by `03-deploy.sh` as `BaseUrl`.

## How it fits together

```
browser ──► CloudFront (one URL)
              ├─ /api/*   → Lambda Function URL  (bff: Hono, Node 22, arm64)
              └─ /*       → S3 (SPA: docs + demo; SPA paths without a dot → /index.html via a CloudFront Function)
bff ──► DynamoDB auth-app-<stage>          (users)
bff ──► auth-gate <stage>  /api/...        (x-internal-access-key: client key, from SSM)
bff ──► auth-gate /.well-known/jwks.json   (cached 300 s) to verify returned tokens
```

The browser only calls same-origin `/api`. Only `bff` talks to auth-gate.

## Run locally

Needs Node 22, pnpm 10.13.1, Docker, `jq`, and an auth-gate you can reach.

```bash
pnpm install
docker compose up -d        # DynamoDB local on :8000
export AUTHGATE_BASE_URL=<auth-gate url> AUTHGATE_ADMIN_KEY=<admin key>
scripts/setup-and-deploy/02-register-client.sh local   # writes bff/.env
pnpm --filter bff dev       # bff on :8787
pnpm --filter app dev       # Vite on :5173, proxies /api to :8787
```

Open http://localhost:5173. `bff/.env.example` lists the variables.

## Deploy

Scripts are in `scripts/setup-and-deploy/`, run in this order:

1. `00-deployer.sh` - once: IAM user `auth-app-deployer` (run with an admin profile).
2. `01-ssm.sh` - once: random session secret and origin-verify value in SSM (a rerun fills only what is missing).
3. `02-build.sh` - build `bff/dist` and `app/dist`.
4. `03-deploy.sh` - SAM stack, upload the site, invalidate CloudFront, print `BaseUrl`.
5. `02-register-client.sh stg` - register with auth-gate; needs the `BaseUrl` from step 4.
6. `03-deploy.sh` again, with `AUTHGATE_CLIENT_ID` set.
7. `04-smoke.sh` - run the Bruno collection (`pnpm exec bru run --env stg` from `bruno/`) against the deployed site. Locally: `pnpm run bruno:local`.

`99-purge.sh` removes what the scripts created.

Deploy needs the AWS CLI, SAM CLI, `openssl`, `curl` and `jq`, besides Node and pnpm.

Deploy is two passes. On the first pass `/auth-app/stg/authgate-client-key` does not
exist in SSM yet, so bff's config load throws at cold start and every `/api` call fails
(502), `/api/health` included, until the second pass. `02-register-client.sh stg` writes
that key and prints the client id as `AUTHGATE_CLIENT_ID=...`; export it for step 6. `03-deploy.sh` and `02-register-client.sh` need
`AUTHGATE_BASE_URL`; the register script also needs `AUTHGATE_ADMIN_KEY`.

## What to copy

If you integrate auth-gate yourself, start from these three files:

- `bff/src/authgate/token.ts` - verify a returned token (signature, `iss`, `aud`, `exp`, `sub`, `purpose`).
- `bff/src/authgate/client.ts` - the calls to auth-gate with the client key.
- `app/src/lib/webauthn.ts` - base64url and ArrayBuffer conversion for WebAuthn.

## Layout

```
app/        React 19 + Vite + Mantine SPA: /docs/* and /app/*
bff/        Hono backend: src/{routes,authgate,users,session,lib}, lambda.ts, server.ts
docs/       en/, vi/ (docs pages), infra/ (workspace and tooling), superpowers/ (specs, plans)
infra/      template.yaml (SAM), deployer-policy.json
scripts/setup-and-deploy/   deploy scripts
bruno/      Bruno collection against /api
tools/wt  .claude   worktree tooling
```

See `CONTRIBUTING.md` before changing code.
