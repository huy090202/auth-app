// Runs against dist/ after `pnpm --filter app build`: `pnpm --filter app test:prerender`. Excluded from `test`, which runs before the build.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pages } from '../src/docs/loader';
import { publicRoutes } from '../src/seo/routes';

const dist = new URL('../dist/', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, dist), 'utf8');
const site = process.env.VITE_SITE_URL?.replace(/\/+$/, '') || 'https://authgatehq.com';
const file = (path: string) => (path === '/' ? 'landing/index.html' : `${path.replace(/^\/|\/$/g, '')}/index.html`);

describe('prerendered output', () => {
  const routes = publicRoutes();
  it('writes a file per route, with its heading, canonical, lang and no noindex', () => {
    for (const r of routes) {
      expect(existsSync(new URL(file(r.path), dist)), r.path).toBe(true);
      const html = read(file(r.path));
      expect(html, r.path).toContain(`<html lang="${r.lang}">`);
      expect(html, r.path).toContain(`<link rel="canonical" href="${site}${r.path}">`);
      expect(html, r.path).not.toContain('noindex');
      if (r.kind === 'docs') {
        const doc = pages[r.lang].find((p) => p.slug === r.slug)!;
        expect(html, r.path).toMatch(new RegExp(`<h1[^>]*>${doc.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      } else {
        expect(html, r.path).toContain('<h1>');
      }
    }
  });
  it('keeps noindex in the shell', () => {
    expect(read('index.html')).toContain('<meta name="robots" content="noindex"');
  });
  it('lists every route in the sitemap and writes robots.txt', () => {
    const sm = read('sitemap.xml');
    for (const r of routes) expect(sm, r.path).toContain(`<loc>${site}${r.path}</loc>`);
    expect(sm).toContain('hreflang="x-default"');
    expect(read('robots.txt')).toBe(`User-agent: *\nAllow: /\nDisallow: /app/\nSitemap: ${site}/sitemap.xml\n`);
  });
  it('removed the SSR bundle', () => {
    expect(existsSync(new URL('../dist-ssr', dist))).toBe(false);
  });
});
