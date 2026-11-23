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
7. `04-smoke.sh` - run the Bruno collection (`bru run --env stg` from `bruno/`) against the deployed site. Locally: `pnpm run bruno:local`.

`99-purge.sh` removes what the scripts created.

Deploy needs the AWS CLI, SAM CLI, `openssl`, `curl` and `jq`, besides Node and pnpm.

Deploy is two passes. On the first pass `/auth-app/stg/authgate-client-key` does not
exist in SSM yet, so bff's config load throws at cold start and every `/api` call fails
(502), `/api/health` included, until the second pass. `02-register-client.sh stg` writes
that key and prints the client id as `AUTHGATE_CLIENT_ID=...`; export it for step 6. `03-deploy.sh` and `02-register-client.sh` need
`AUTHGATE_BASE_URL`; the register script also needs `AUTHGATE_ADMIN_KEY`.
To serve on a custom domain see [Custom domain](#custom-domain).

## Custom domain

The site lives at the apex `https://authgatehq.com` (docs, demo and `/api` on one name). Its
passkey rpId is `authgatehq.com`, and it calls AuthGate on `https://api.authgatehq.com`. The
other apps have their own names (`portal.`, `admin.`, `api.`); the decision, the design and the
shared certificate are in auth-gate's `docs/reference/custom-domain.md` and
`docs/runbooks/rollout-custom-domain.md`. This repository only adds the apex.

- **DNS only.** DNS is at Cloudflare and you create the records. No script writes DNS and no API
  token exists. The record is DNS only (grey cloud), never proxied: a proxy would hide the
  viewer's IP. The apex already carries MX and TXT records (Cloudflare Email Routing); adding the
  `@` CNAME beside them is allowed, because Cloudflare flattens a CNAME at the apex.
- **The certificate is auth-gate's.** `*.authgatehq.com` plus the apex, in `us-east-1`. Request it
  there (`00-cert.sh`, wait for `ISSUED`). `00-domain.sh` only copies its ARN from
  `/credo/auth-gate/<stage>/certificate-arn` into `/auth-app/<stage>/certificate-arn` and records
  `/auth-app/<stage>/domain`. A deploy stops before `sam` unless the certificate is `ISSUED`.
- **With no `domain` parameter nothing changes:** the deploy uses the CloudFront address.
- **Forward-only per stack.** Once a stack was deployed with a domain, deleting the SSM parameters
  does not move it back, because `sam deploy` reuses the previous values.
- **The old address redirects.** Any other `Host` than the apex gets `301` to
  `https://authgatehq.com<path and query>` on the site. `/api/*` is never redirected.
- **Cost: demo users enrol again.** AuthGate refuses an rpId change, so auth-app gets a new client
  and every PIN and passkey under the old one is gone. A demo account still exists, but its
  owner sets a PIN or a passkey again.

### Rollout (stg)

Run it once, from this worktree, after auth-gate's rollout has reached its step 4 (certificate
`ISSUED`, AuthGate live on `api.authgatehq.com`, auth-app already redeployed on that base URL).
Admin steps use the admin profile `default`; the rest use the scripts' own defaults
(`auth-app-deployer`, `ap-southeast-1`, stage `stg`), so set none of them. No secret goes on a
command line. The apex record goes in before the deploy, so the name already resolves when the
deploy attaches it.

From step 4 (the domain deploy) until step 6 (the deploy with the new client id) the demo's
sign-in and step-up do not work: the stack is on the new name and token issuer, but still carries
the old client, whose rpId no longer matches. Run steps 4 to 6 back to back.

**1. The ACM right for the deployer.** The deployer reads the certificate's status.

```bash
(
set -euo pipefail
cd /home/work/auth-app/feat-custom-domain
ADMIN_PROFILE=default scripts/setup-and-deploy/00-deployer.sh
sleep 60   # IAM propagation
)
```

Expect `user auth-app-deployer exists; updating its policy only`, then
`updated policy auth-app-deployer-policy`, then
`profile auth-app-deployer already configured; not creating another access key`.

**2. Record the domain.**

```bash
(
set -euo pipefail
cd /home/work/auth-app/feat-custom-domain
ADMIN_PROFILE=default scripts/setup-and-deploy/00-domain.sh authgatehq.com
)
```

Expect `domain:          authgatehq.com`, `certificate-arn: arn:aws:acm:us-east-1:...` and
`Wrote /auth-app/stg/domain and /auth-app/stg/certificate-arn`.

**3. The `@` record at Cloudflare, before the deploy.** Cloudflare dashboard, `authgatehq.com`,
DNS, Records, Add record; Type `CNAME`, Name `@`, Target `d3d49hg6rb8ylx.cloudfront.net` (today's
`BaseUrl` host; the in-place update in step 4 keeps it), Proxy status DNS only (grey cloud),
Save. Add the record first, and query the name only afterwards: a resolver asked for the apex's
A record before the CNAME existed may cache "no data" for up to 1800 s. Then check that it
resolves:

```bash
for i in $(seq 10); do getent ahostsv4 authgatehq.com >/dev/null && printf 'ok ' || printf 'FAIL '; sleep 1; done; echo
```

Expect `ok ok ok ok ok ok ok ok ok ok`. If it prints `FAIL`, wait and run the loop again. This
proves DNS only: until the deploy in step 4 attaches the alias, the apex answers 403, so do not
curl or smoke it yet.

**4. Build and deploy on the new name.** The base URL defaults to `https://api.authgatehq.com`.
`AUTHGATE_CLIENT_ID` stays unset, so the stack keeps the old client id for now. From here the
demo's sign-in does not work until step 6.

```bash
cd /home/work/auth-app/feat-custom-domain && pnpm install --frozen-lockfile && (
set -euo pipefail
scripts/setup-and-deploy/02-build.sh
scripts/setup-and-deploy/03-deploy.sh
)
```

Expect `built bff/dist and app/dist`, the `sam` changeset, `invalidated <id>` and
`BaseUrl: https://authgatehq.com`. A CloudFront update takes several minutes. The line
`AUTHGATE_CLIENT_ID is empty: ...` is expected here: the stack keeps its client id.

**5. Register the new client.** This reads the admin key from auth-gate's SSM parameter under
the admin profile, into the environment of the subshell only, and asks you to type a
confirmation. Note the old client id it prints.

```bash
cd /home/work/auth-app/feat-custom-domain && (
set -euo pipefail
export AUTHGATE_BASE_URL=https://api.authgatehq.com
AUTHGATE_ADMIN_KEY="$(aws ssm get-parameter --profile default --region ap-southeast-1 \
  --name /credo/auth-gate/stg/admin-key --with-decryption --query Parameter.Value --output text)"
export AUTHGATE_ADMIN_KEY
scripts/setup-and-deploy/02-register-client.sh stg --replace   # asks: Type 'replace auth-app-stg' ...
)
```

Expect the prompt `Type 'replace auth-app-stg' to register a new client and overwrite the stored key:`;
type exactly `replace auth-app-stg`. Then `registered auth-app-stg; wrote /auth-app/stg/authgate-client-key (SecureString)`,
`AUTHGATE_CLIENT_ID=<new id>   # pass this to 03-deploy.sh` and
`disable the old client <old id> in the Console once the new one works`. Write down both ids.
If the script stops before the confirmation nothing has changed. Do not run this block twice: a
second `--replace` registers another client and orphans the first.

**6. Deploy with the new client id.**

```bash
cd /home/work/auth-app/feat-custom-domain && (
set -euo pipefail
read -r -p 'AUTHGATE_CLIENT_ID printed above: ' AUTHGATE_CLIENT_ID
[ -n "$AUTHGATE_CLIENT_ID" ] || { echo 'no client id given' >&2; exit 1; }
export AUTHGATE_CLIENT_ID
scripts/setup-and-deploy/03-deploy.sh
)
```

Expect `invalidated <id>` and `BaseUrl: https://authgatehq.com`, and no `AUTHGATE_CLIENT_ID is
empty` line.

**7. Check the record.** Read only. This is auth-gate's script; its `@` row must equal
`d3d49hg6rb8ylx.cloudfront.net`. Other rows may say `pending`: they are not this repository's
concern.

```bash
( cd /home/work/auth-gate/main && ADMIN_PROFILE=default AWS_REGION=ap-southeast-1 scripts/domain/dns-records.sh )
```

**8. Smoke.** `04-smoke.sh` refuses to run when `bruno/environments/stg.yml` already exists (it
writes a throwaway file of that name and deletes it afterwards). A leftover one comes from a
copy of `stg.example.yml` or an interrupted run: move it away (`mv bruno/environments/stg.yml
bruno/environments/stg.yml.bak`) and put it back afterwards.

```bash
cd /home/work/auth-app/feat-custom-domain && ( scripts/setup-and-deploy/04-smoke.sh )
```

Expect `bruno: https://authgatehq.com`, the Bruno run, the two `curl:` checks and `smoke ok`.

**9. In a browser.** Open `https://authgatehq.com`, open the demo, register a demo account, set a
PIN, then do a step-up. An account that existed under the old client sets its factor again the
same way.

**10. Disable the old client, then delete it.** Open the Console at `https://admin.authgatehq.com`,
Clients, open the client whose id step 5 printed as the old one (the new one has the same name,
`auth-app-stg`; the id tells them apart), Availability, Disable client. About a week later, if
nothing broke, open it again and Delete client, and confirm.

**11. The old address redirects.** Read only; path and query are kept, and the `q` value is
unchanged:

```bash
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' 'https://d3d49hg6rb8ylx.cloudfront.net/docs/step-up?a=1&a=2&q=a%20b'
```

Expect `301 https://authgatehq.com/docs/step-up?a=1&a=2&q=a%20b`.

If a line in step 5 or 6 fails, resume from that line; do not rerun the whole block.

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
