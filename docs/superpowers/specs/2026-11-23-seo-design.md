# SEO for authgatehq.com: a landing page, language in the URL, prerendered pages

Date: 2026-11-23. Status: approved by the owner in chat the same day. He reviewed the landing
mockup, `2026-11-23-seo-landing-mockup.html`, beside this file.

## 1. Purpose

auth-app (docs and a demo of AuthGate) is live on `https://authgatehq.com`, but Google cannot use
it well, for three reasons:

- The page is an empty `<div id="root">` until JavaScript runs.
- The language lives in localStorage, so one URL serves EN or VI and Google only ever sees EN.
- `/` redirects straight to a docs page.

This change makes every public page a real HTML document in its own language, adds a landing
page, and gives Google the sitemap, metadata and verification it needs.

Decided by the owner (not re-askable):

- EN at the root, VI under `/vi`. The owner chose "EN gốc, VI có /vi".
- A new bilingual landing page at `/` and `/vi/`, shaped like the mockup.
- The footer links the source on GitHub, `https://github.com/huy090202/auth-gate`.
- Google Search only. No paid ads. No fixed cost.

**Done when:**

- `curl https://authgatehq.com/` and `curl https://authgatehq.com/vi/docs/step-up` return HTML
  that contains the page's text, `<html lang>`, `<title>`, description, canonical, `hreflang` and
  Open Graph tags.
- `sitemap.xml` and `robots.txt` are served.
- The demo (`/app/*`) carries `noindex`.
- Search Console has verified the domain, and the sitemap is submitted with no errors.
- The smokes pass and `pnpm run check` is green.

## 2. URLs

| Page | EN | VI |
|---|---|---|
| Landing | `/` | `/vi/` |
| Docs page | `/docs/<slug>` | `/vi/docs/<slug>` |
| Demo (not indexed) | `/app/...` | `/app/...` (language from the stored preference, as today) |

- The language comes from the URL on the landing and docs pages.
- The EN/VI control navigates to the same page in the other language, and stores the choice as
  today.
- A visitor who stored `vi` and opens an EN landing or docs URL is moved client-side to the `/vi`
  twin. Crawlers have no storage, so Google sees each URL as itself.
- Old links keep working: `/docs/<slug>` is the EN page, as before.
- An unknown docs slug still lands on the language's `what-it-is` page.
- Internal links, the brand link and "Try it" buttons stay in the current language.

## 3. The landing page

- It follows the mockup: hero, the three-call code block, "How a step-up works" in three steps,
  "What you don't have to build" in six cards, the "Try it" band, and the footer.
- Every claim is one the docs already make. The copy is in `app/src/landing/strings.ts`, EN and
  VI. The VI copy is natural Vietnamese, not a word-for-word translation.
- The buttons:
  - "Sign up on the Portal" goes to the Portal sign-up URL that already exists (`portalSignUpUrl`);
  - "Try the demo" goes to `/app/login`;
  - "Read the docs" goes to the language's `what-it-is` page.
- The header gains a "Docs" and a "Demo" link where the docs header has them. The brand links to
  the language's landing.

## 4. Prerendering

- The SPA gains an SSR entry, `app/src/entry-server.tsx`. It renders a route to a string with
  `react-dom/server` and react-router's static rendering.
- A Vite SSR build compiles that entry. `vite build --ssr` keeps `import.meta.glob` working for
  the Markdown docs.
- A script, `app/scripts/prerender.mjs`, runs after `vite build`:
  - it renders every public route (landing × 2, every docs slug × 2);
  - it writes `dist/<path>/index.html` from the built `index.html` template, with the rendered
    markup inside `#root` and the head tags of §5;
  - it writes `sitemap.xml` and `robots.txt`.
- The browser still starts the app with `createRoot`, not hydration, so a stored colour scheme or
  a client-only difference can never break the page. The prerendered markup is replaced by the
  same content when JavaScript runs.
- The site origin for absolute URLs is `VITE_SITE_URL`, default `https://authgatehq.com`.

## 5. Head tags per page

- `<html lang="en|vi">`.
- `<title>`: the landing's from its strings; a docs page's from its own title.
- `<meta name="description">`: the landing's from its strings; a docs page's from its first
  paragraph, at most 160 characters.
- `<link rel="canonical">`.
- `<link rel="alternate" hreflang="en|vi|x-default">`, with `x-default` set to EN.
- Open Graph and Twitter tags: `og:title`, `og:description`, `og:url`, `og:type`, `og:locale`,
  and `og:image` pointing at `/og.png`. That is a 1200×630 PNG: the logo and wordmark on the
  Canopy background, made once and committed.
- The SPA shell (`index.html`, served for `/app/*`) carries `<meta name="robots" content="noindex">`.
  Prerendered pages do not.

## 6. Serving

- The CloudFront Function `SpaRewrite` keeps its redirect from foreign hosts. Then:
  - `/` and `/vi/` (and `/vi`) map to their `index.html`;
  - `/docs/<slug>` and `/vi/docs/<slug>` map to `/<path>/index.html` when the slug is known;
  - anything else without a dot in its last segment maps to `/index.html`, the SPA shell, as today.
- The known slugs come from a new template parameter, `DocSlugs`, a comma-separated list
  substituted into the function code. `03-deploy.sh` reads it from `docs/en/*.md`. So an unknown
  slug never reaches S3, which would answer 403 for a missing object.
- `sitemap.xml`, `robots.txt` and `og.png` are plain files.
- The S3 sync uploads `dist/` as it does now.

## 7. Search Console, and the other apps

- **Search Console:** add a Domain property for `authgatehq.com`, verified by a TXT record at
  Cloudflare (DNS only, the record Google gives), then submit
  `https://authgatehq.com/sitemap.xml`. The README gives the clicks.
- **The Portal and the Console** (auth-gate repository): `<meta name="robots" content="noindex">`
  in `portal-web/index.html` and `console-web/index.html`. It is a separate, one-commit change in
  that repository, done after this one.

## 8. Tests

- Pure functions, tested:
  - the route list;
  - `headFor(route)`: title, description, canonical, alternates, OG, lang;
  - the description extraction and its 160-character limit;
  - the language from a path, and the twin path.
- The prerender, run in a test against a built fixture or the real build:
  - every route gets a file;
  - each file contains its page's heading text and the right `lang`, canonical and `hreflang`;
  - the shell keeps `noindex`;
  - the sitemap lists every route with its alternates.
- The CloudFront Function (node test, extending the existing one):
  - the foreign-host redirect still works;
  - `/`, `/vi`, `/vi/`, `/docs/step-up` and `/vi/docs/step-up` map to their prerendered files;
  - `/docs/nope` maps to the shell;
  - `/app/login` maps to the shell;
  - `/assets/x.js` is unchanged.
- The existing app tests, the smoke and `pnpm run check` stay green.

## 9. Non-goals

- Paid ads.
- Analytics or tracking scripts.
- Server-side rendering at request time.
- Indexing the demo.
- A blog.
- Translating beyond EN and VI.
- Changing the docs' content (only its links and head tags).
