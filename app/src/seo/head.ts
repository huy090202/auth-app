import type { Lang } from '../lib/i18n';
import type { Route } from './routes';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The URL of a route's twin in another language. */
export function urlFor(route: Route, lang: Lang, site: string): string {
  const path = route.kind === 'landing' ? (lang === 'en' ? '/' : '/vi/') : lang === 'en' ? `/docs/${route.slug}` : `/vi/docs/${route.slug}`;
  return site + path;
}

/** The head markup of spec §5 for one page: title, description, canonical, alternates, Open Graph and Twitter. Every value is escaped. */
export function headFor(route: Route, site: string): string {
  const title = esc(route.title);
  const description = esc(route.description);
  const url = esc(site + route.path);
  const image = esc(`${site}/og.png`);
  const locale = route.lang === 'vi' ? 'vi_VN' : 'en_US';
  const en = esc(urlFor(route, 'en', site));
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" hreflang="en" href="${en}">`,
    `<link rel="alternate" hreflang="vi" href="${esc(urlFor(route, 'vi', site))}">`,
    `<link rel="alternate" hreflang="x-default" href="${en}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="AuthGate">`,
    `<meta property="og:locale" content="${locale}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join('\n    ');
}
