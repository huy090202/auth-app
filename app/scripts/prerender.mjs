// After `vite build` and the SSR build: write one HTML file per public route, sitemap.xml and robots.txt.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const ssr = join(root, 'dist-ssr');
const site = (process.env.VITE_SITE_URL || 'https://authgatehq.com').replace(/\/+$/, '');

const { render, headFor, urlFor, publicRoutes } = await import(pathToFileURL(join(ssr, 'entry-server.js')).href);
const shell = await readFile(join(dist, 'index.html'), 'utf8');

function swap(html, re, to, what) {
  if (!re.test(html)) throw new Error(`prerender: the shell has no ${what}`);
  return html.replace(re, () => to);
}

function page(route) {
  let html = swap(shell, /<html lang="[^"]*">/, `<html lang="${route.lang}">`, '<html lang>');
  html = swap(html, /\s*<title>[\s\S]*?<\/title>/, '', '<title>');
  html = swap(html, /\s*<meta name="description"[^>]*>/, '', 'description');
  html = swap(html, /\s*<meta name="robots" content="noindex"\s*\/?>/, '', 'noindex');
  html = swap(html, /\s*<\/head>/, `\n    ${headFor(route, site)}\n  </head>`, '</head>');
  return swap(html, /<div id="root"><\/div>/, `<div id="root">${render(route.path)}</div>`, '#root');
}

/** The EN landing is `/`, but dist/index.html stays the SPA shell for /app/*; CloudFront maps `/` to landing/index.html. */
const fileFor = (path) => (path === '/' ? 'landing/index.html' : `${path.replace(/^\/|\/$/g, '')}/index.html`);

const routes = publicRoutes();
for (const route of routes) {
  const file = join(dist, fileFor(route.path));
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, page(route));
}

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const entries = routes.map((r) => {
  const en = xml(urlFor(r, 'en', site));
  return [
    '  <url>',
    `    <loc>${xml(site + r.path)}</loc>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>`,
    `    <xhtml:link rel="alternate" hreflang="vi" href="${xml(urlFor(r, 'vi', site))}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>`,
    '  </url>',
  ].join('\n');
});
await writeFile(
  join(dist, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join('\n')}\n</urlset>\n`,
);
await writeFile(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`);

await rm(ssr, { recursive: true, force: true });
console.log(`prerendered ${routes.length} pages, sitemap.xml, robots.txt`);
