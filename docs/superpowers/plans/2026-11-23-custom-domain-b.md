# auth-app on authgatehq.com (custom domain, plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- auth-app (docs and demo) serves on the apex `https://authgatehq.com`, with the old CloudFront address answering 301.
- It has a new AuthGate client for the rpId `authgatehq.com` and talks to `https://api.authgatehq.com`.

**Architecture:** This is plan A's pattern, applied to this repository.
- The template gains `DomainName` and `CertificateArn`, the aliases and the viewer certificate, and a redirect in `SpaRewrite`.
- The deploy reads this repository's own SSM parameters `/auth-app/<stage>/domain` and `/auth-app/<stage>/certificate-arn`.
- `02-register-client.sh stg --replace` registers the new client.
- The certificate is the one plan A issued: apex plus wildcard, in us-east-1.

**Tech Stack:** SAM/CloudFormation, CloudFront Functions (cloudfront-js-2.0), bash with stub-`aws` tests, node:test.

**Spec:** auth-gate repository, `docs/superpowers/specs/2026-11-23-custom-domain-design.md`: §2 (names), §3 (redirect, DNS only), §4 "auth-app", §6 (new clients), §7 (plan B). Plan A, already live, is `docs/superpowers/plans/2026-11-23-custom-domain-a.md` in that repository. Its files are the reference implementation:
- `infra/console.yaml`, the `SpaRewrite` and `Distribution` parts;
- `infra/functions/test/spa-rewrite.test.mjs`;
- `scripts/domain/lib.sh`;
- `scripts/console/register-client.sh` (`--replace`);
- `scripts/domain/test/*.sh`.

Read them at `/home/work/auth-gate/main`.

## Global Constraints

- Hostname: the apex `authgatehq.com`; rpId `authgatehq.com`; origin `https://authgatehq.com`. AuthGate base URL `https://api.authgatehq.com`.
- SSM parameters: `/auth-app/<stage>/domain` and `/auth-app/<stage>/certificate-arn`. Ruling: the spec wrote `/credo/auth-app/…`, but this repository's prefix is `/auth-app/<stage>` and its deployer reads only `/auth-app/*`. The spec's intent holds: no right on auth-gate's parameters.
- With no `domain` parameter, a deploy is unchanged and uses the CloudFront address. Once deployed with a domain, a stack moves forward only (sam reuses previous values).
- Every DNS record is DNS only. The apex `@` CNAME is flattened by Cloudflare. No DNS API, no tokens.
- The redirect: `301` to `https://authgatehq.com<path and query>` when the `Host` header is not `authgatehq.com`.
  - Only on the site behaviour, never on `/api/*`.
  - Query values are normalised as `encodeURIComponent(tryDecode(v))`, with order and repeats kept, exactly as plan A.
  - An empty hostname means no redirect.
- Secrets never on argv, never printed: admin key and client key through 0600 files. Never call real AWS in tests; never read `~/.aws`.
- English in code, docs and commits. Conventional Commits, each ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Gate: `pnpm run check`.

## Review Focus

1. A first deploy, or a stage with no domain: the template and the scripts behave exactly as today. Pinned in Tasks 1 and 2.
2. A mixed-case domain argument: the domain is lowercased where it is written to SSM, so the redirect cannot loop. Pinned in Task 2.
3. `--replace` with a failing POST: the stored key is untouched, and nothing is written before the typed confirmation. Pinned in Task 3.
4. A deploy while the certificate is not `ISSUED`, or the ARN is missing: it stops before `sam`. Pinned in Task 2.
5. The shellcheck download hitting GitHub's API rate limit fails CI, as it did in auth-gate. Pin the release. Task 4.

---

### Task 1: The template on the apex, with the redirect

**Files:**
- Modify: `infra/template.yaml`
- Create: `infra/functions/test/spa-rewrite.test.mjs`
- Modify: `package.json`, so its `test` runs `node --test infra/functions/test/*.test.mjs`.

**Interfaces:**
- Produces:
  - parameters `DomainName` (default `""`) and `CertificateArn` (default `""`, AllowedPattern `^$|^arn:aws:acm:us-east-1:\d{12}:certificate/[0-9a-f-]+$`);
  - condition `HasDomain`;
  - outputs `BaseUrl` (`https://<DomainName>` with a domain, the CloudFront URL without) and `DistributionDomain` (the `*.cloudfront.net` name, always).

- [ ] **Step 1: Write the failing test.** Copy the shape of auth-gate's `infra/functions/test/spa-rewrite.test.mjs`, extracting `SpaRewrite`'s `FunctionCode: !Sub` from `infra/template.yaml`. Cases, with hostname `authgatehq.com`:
  - Host `d3d49hg6rb8ylx.cloudfront.net`, uri `/docs/step-up`, query `a=1&a=2&q=a b`: expect `statusCode` 301 and `location` `https://authgatehq.com/docs/step-up?a=1&a=2&q=a%20b`.
  - The same with `q=a%20b` given raw: the same location.
  - Host `AuthGateHQ.com` (mixed case): no redirect.
  - Host `authgatehq.com`, uri `/docs/step-up`: uri becomes `/index.html` (the SPA rewrite).
  - Host `authgatehq.com`, uri `/assets/x.js`: unchanged.
  - Hostname `""` with host `d3d49hg6rb8ylx.cloudfront.net`: no redirect, and the SPA rewrite still applies.
  - A malformed escape `%E0%A4%A` in a value: no throw.
- [ ] **Step 2:** Run `node --test infra/functions/test/*.test.mjs`. Expected: FAIL, because the function has no `${Hostname}` yet.
- [ ] **Step 3: Implement.**
  - `SpaRewrite.FunctionCode` becomes `!Sub` with `Hostname: !If [HasDomain, !Ref DomainName, ""]`. Use the same function body as auth-gate's `infra/console.yaml`.
  - `Distribution`: `Aliases: !If [HasDomain, [!Ref DomainName], !Ref AWS::NoValue]`, and `ViewerCertificate: !If [HasDomain, {AcmCertificateArn: !Ref CertificateArn, SslSupportMethod: sni-only, MinimumProtocolVersion: TLSv1.2_2021}, !Ref AWS::NoValue]`.
  - The outputs as in Interfaces.
  - Add the cfn-lint W1030 ignore on the distribution if `sam validate --lint` raises it, as auth-gate did.
- [ ] **Step 4:** Run the node test and `sam validate --lint -t infra/template.yaml`. Expected: PASS and valid.
- [ ] **Step 5: Gate and commit.** `pnpm run check`, then `git commit -m "feat(infra): auth-app on the apex domain, the old address redirected"`.

### Task 2: The deploy reads the domain; an admin script records it

**Files:**
- Create: `scripts/setup-and-deploy/domain.sh` (sourced library), `scripts/setup-and-deploy/00-domain.sh` (admin)
- Modify: `scripts/setup-and-deploy/03-deploy.sh`, `infra/deployer-policy.json`, `tools/lint-shell.sh` (lint the new test directory)
- Create: `scripts/setup-and-deploy/test/domain.sh`, `scripts/setup-and-deploy/test/03-deploy.sh` (stub `aws` and `sam`); wire them into `package.json` `test`

**Interfaces:**
- Produces:
  - `domain_config`: sourced after `lib.sh`. It sets `DOMAIN` and `CERT_ARN` from `$PARAM_PREFIX/domain` and `$PARAM_PREFIX/certificate-arn`.
    - `ParameterNotFound` on `domain` gives empty values.
    - Any other error exits.
    - A missing ARN exits.
    - A certificate that is not `ISSUED` exits, with `aws acm describe-certificate --region us-east-1`.
    - It fails closed with or without `set -e`, as auth-gate's `scripts/domain/lib.sh` does.
  - `00-domain.sh DOMAIN`: admin (`ADMIN_PROFILE`, default `default`).
    - Lowercases `DOMAIN`.
    - Reads the certificate ARN from auth-gate's `/credo/auth-gate/$STAGE/certificate-arn`.
    - Writes `$PARAM_PREFIX/domain` and `$PARAM_PREFIX/certificate-arn` as String with `--overwrite`, through `--cli-input-json` from a 0600 file.
    - Prints both values.

- [ ] **Step 1: Write the failing tests.**
  - `test/domain.sh`:
    - no parameter gives empty values;
    - present and ISSUED gives both values;
    - PENDING_VALIDATION exits non-zero;
    - an `AccessDenied` from SSM exits non-zero;
    - a probe without `set -e` still stops;
    - every ACM call carries `--region us-east-1`.
  - `test/03-deploy.sh`, with `sam` stubbed to record argv and exit 1:
    - with a domain, the args contain `DomainName=authgatehq.com` and `CertificateArn=arn:…`, and `AuthGateBaseUrl=https://api.authgatehq.com` when `AUTHGATE_BASE_URL` is unset;
    - an explicit `AUTHGATE_BASE_URL` wins;
    - without a domain, no `DomainName=` is passed and `AUTHGATE_BASE_URL` stays required.
  - A case for `00-domain.sh` with `Mixed.Example.COM`: the written domain is `mixed.example.com`, and the ARN is copied from the stubbed auth-gate parameter.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `03-deploy.sh` calls `domain_config`. With `$DOMAIN` set:
    - it defaults `AUTHGATE_BASE_URL` to `https://api.$DOMAIN`;
    - it adds `DomainName=$DOMAIN` and `CertificateArn=$CERT_ARN`;
    - it prints `BaseUrl:` from the outputs as now.
  - Deployer policy: add a statement `ReadTheCertificate` with `acm:DescribeCertificate` on `arn:aws:acm:us-east-1:826113468815:certificate/*`. The SSM statement already covers `/auth-app/*`.
  - Update the header comments.
- [ ] **Step 4:** Run the tests and `bash tools/lint-shell.sh`. Expected: PASS.
- [ ] **Step 5: Gate and commit.** `pnpm run check`, then `git commit -m "feat(deploy): auth-app reads its domain from ssm; an admin script records it"`.

### Task 3: A new client for the new rpId

**Files:**
- Modify: `scripts/setup-and-deploy/02-register-client.sh`
- Create: `scripts/setup-and-deploy/test/02-register-client.sh` (stub `aws` and `curl`)

**Interfaces:**
- Consumes `domain_config` (Task 2).
- Produces `02-register-client.sh stg --replace`. It follows auth-gate's `scripts/console/register-client.sh --replace`:
  - `--replace` only with `stg`. `local --replace` is a usage error, exit 2.
  - With no stored key, `--replace` registers as today, with no prompt.
  - With a stored key, in this order:
    1. When `DOMAIN` is set, the stack's `BaseUrl` host must equal `$DOMAIN`, else die with "deploy with the domain first".
    2. The prompt `Type 'replace auth-app-stg' to register a new client and overwrite the stored key:` is read from stdin. Any other answer, or EOF, changes nothing.
    3. POST `/api/clients` with rpId `$DOMAIN` and origin `https://$DOMAIN`.
    4. `put-parameter --overwrite` of `$PARAM_PREFIX/authgate-client-key` through a 0600 file.
  - It prints `AUTHGATE_CLIENT_ID=<new id>`, then `disable the old client <old id> in the Console once the new one works`. The old id is read from the stack's `AuthGateClientId` parameter or output; whichever exists, and the id is omitted when unreadable.
  - Without `--replace`, it still refuses to overwrite.

- [ ] **Step 1: Write the failing tests:**
  - without `--replace` and with a stored key: refuses, no POST;
  - wrong answer: no POST and no `put-parameter`;
  - right answer: one POST whose body has rpId `authgatehq.com` and origin `https://authgatehq.com`, then one `put-parameter --overwrite`;
  - a POST answering 500: no `put-parameter`;
  - `BaseUrl` still on cloudfront.net: dies before any POST;
  - `local --replace`: exit 2;
  - the admin key and the new client key appear in no argv and no output.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Keep the admin key as today: `AUTHGATE_ADMIN_KEY` env, written to the 0600 header file.
- [ ] **Step 4:** Run the tests and lint. Expected: PASS.
- [ ] **Step 5: Gate and commit.** `pnpm run check`, then `git commit -m "feat(scripts): register-client can replace auth-app's client for a new rpid"`.

### Task 4: Pin shellcheck, docs and the rollout

**Files:**
- Modify: `tools/lint-shell.sh`: set `SHELLCHECKJS_RELEASE=v0.11.0` so the wrapper downloads that release directly and never calls GitHub's API.
- Modify: `README.md`: a "Custom domain" section.
- Modify: docs that name the old address, if any (`grep -rn "cloudfront.net" --include=*.md --include=*.ts* . | grep -v node_modules | grep -v docs/superpowers`). `bruno/environments/stg.example.yml` may keep a placeholder.

- [ ] **Step 1:** The lint pin. Run `pnpm run lint`. In a fresh `node_modules`, the wrapper's log must show a download from `releases/download/v0.11.0` and no `api.github.com`.
- [ ] **Step 2: The README section.**
  - What the names are.
  - Why DNS only.
  - Forward-only per stack.
  - The rollout as paste-ready subshell blocks in auth-gate's house style (its `docs/runbooks/rollout-custom-domain.md`):
    1. `ADMIN_PROFILE=default scripts/setup-and-deploy/00-deployer.sh` (the ACM right).
    2. `ADMIN_PROFILE=default scripts/setup-and-deploy/00-domain.sh authgatehq.com`.
    3. Build and deploy, which serves the alias, with the old client id kept.
    4. In auth-gate's worktree, `ADMIN_PROFILE=default scripts/domain/dns-records.sh`: add the `@` CNAME at Cloudflare, DNS only, then check that it resolves with `getent ahostsv4 authgatehq.com` in a loop before any smoke.
    5. Register with `--replace`, reading the admin key from `/credo/auth-gate/stg/admin-key` into the environment, never onto argv.
    6. Deploy with `AUTHGATE_CLIENT_ID=<new id>`.
    7. Run `04-smoke.sh`.
    8. In a browser: register a demo account, set a PIN, and do a step-up.
    9. Disable the old client in the Console, and delete it about a week later.
    10. Check that the old CloudFront address answers 301 with path and query kept.
  - State the cost: demo users enrol their factors again.
- [ ] **Step 3: Gate and commit.** `pnpm run check`, then `git commit -m "docs: auth-app on authgatehq.com, its rollout, and a pinned shellcheck"`.

After the merge, auth-gate's README links "Docs and live demo" to `https://authgatehq.com` and drops the CloudFront host. That is a one-line change in that repository, outside this plan.
