# Search engines

> **Status: a record, not a procedure.** This file records the stg rollout run on 2026-11-23 from
> the worktree of branch `feat/seo`. That branch is now merged, so its worktree path, its "deploy
> only from this worktree" line and its "merge the branch" step 4 are history. Do not rerun it as
> a whole.

Google indexes the prerendered pages only: the landing (`/`, `/vi/`) and the docs
(`/docs/<slug>`, `/vi/docs/<slug>`), each with a canonical URL and `hreflang` `en`, `vi` and
`x-default`. The demo under `/app/...` is not indexed: its shell `index.html` carries
`<meta name="robots" content="noindex">`. `sitemap.xml` and `robots.txt` are built into `app/dist`.

CloudFront serves the prerendered pages through the `SpaRewrite` function. `03-deploy.sh` passes it
the slug list as the `DocSlugs` parameter, from `docs/en/*.md`, and stops if `docs/vi` has other
files. The list must also match `slugs` in `app/src/docs/loader.ts`, or the deploy stops. A slug that is not in the list, in either language, gets the SPA shell, which redirects to
that language's `what-it-is`. Add a docs page in both languages, then rebuild and deploy.

## Search Console (once)

1. Open Google Search Console, Add property, Domain, `authgatehq.com`.
2. Copy the TXT value it shows.
3. At Cloudflare, `authgatehq.com`, DNS, Records, Add record: Type `TXT`, Name `@`, Content the
   value, Save. (TXT records are never proxied, so this is DNS only.)
4. Back in Search Console, Verify.
5. Sitemaps, submit `https://authgatehq.com/sitemap.xml`.
6. URL inspection on `https://authgatehq.com/` and `https://authgatehq.com/vi/docs/step-up`,
   Request indexing.

`VITE_SITE_URL` sets the canonical origin for the build (canonicals, hreflang, the sitemap and
`robots.txt`); the default is `https://authgatehq.com`. Another stage or domain sets it at build
time, for example `VITE_SITE_URL=https://stg.example.com scripts/setup-and-deploy/02-build.sh`.

## Rollout

Deploy only from this worktree until the branch is merged: `main`'s template has no `DocSlugs`,
so a deploy from `main` sends every docs page back to the shell.

**1. Build, deploy and smoke-test.** `04-smoke.sh` writes a throwaway
`bruno/environments/stg.yml`; it stops if that file already exists, so move it away first.

```bash
cd /home/work/auth-app/feat-seo && pnpm install --frozen-lockfile && (
set -euo pipefail
scripts/setup-and-deploy/02-build.sh
scripts/setup-and-deploy/03-deploy.sh
scripts/setup-and-deploy/04-smoke.sh
)
```

Expect `prerendered 22 pages, sitemap.xml, robots.txt` from the build, then `invalidated <id>`,
`BaseUrl: https://authgatehq.com`, `RawBffUrl: ...` and
`AUTHGATE_CLIENT_ID is unset: the stack keeps its previous client id` from the deploy, and
`smoke ok` last.

**2. Check the live site.** Each line prints a short value to compare with the one after `#`.

```bash
S=https://authgatehq.com
curl -s $S/ | grep -o '<html lang="en"'                                  # <html lang="en"
curl -s $S/ | grep -o '<link rel="canonical" href="[^"]*"'               # href="https://authgatehq.com/"
curl -s $S/ | grep -c noindex                                            # 0
curl -s $S/vi/docs/step-up | grep -o '<html lang="vi"'                   # <html lang="vi"
curl -s $S/vi/docs/step-up | grep -o '<link rel="canonical" href="[^"]*"'  # href="https://authgatehq.com/vi/docs/step-up"
curl -s $S/vi/docs/step-up | grep -c 'hreflang'                          # 3
curl -s $S/app/login | grep -c noindex                                   # 1
curl -s $S/docs/nope | grep -c noindex                                   # 1 (the shell, not a 403)
curl -s -o /dev/null -w '%{http_code}\n' $S/docs/nope                    # 200
curl -s $S/robots.txt                                                    # the three lines below
curl -s -o /dev/null -w '%{http_code}\n' $S/sitemap.xml                  # 200
```

Expect `robots.txt` to be exactly `User-agent: *`, `Allow: /` and
`Sitemap: https://authgatehq.com/sitemap.xml`. It has no `Disallow: /app/` on purpose: Google must
fetch `/app/*` to read the shell's `noindex`.

If the `/` checks do not show the landing (no `lang="en"` and canonical `/`, or a `noindex`
of `1`), CloudFront gave the function `/index.html` and the `DefaultRootObject` setting is
interfering with `SpaRewrite`. Stop and fix that before the Search Console steps.

**3.** Do the Search Console steps above.

**4.** Merge the branch.
