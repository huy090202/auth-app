import { pages, rawDocs, parseFrontmatter, slugs } from '../docs/loader';
import { docsTitle } from '../brand';
import { landingStrings } from '../landing/strings';
import type { Lang } from '../lib/i18n';
import { clamp, describe } from './describe';

export type Route = {
  /** URL path: `/`, `/vi/`, `/docs/<slug>`, `/vi/docs/<slug>`. */
  path: string;
  lang: Lang;
  kind: 'landing' | 'docs';
  slug?: string;
  title: string;
  description: string;
};

const langs: Lang[] = ['en', 'vi'];

/** Every page that is prerendered and listed in the sitemap: the landing and each docs page, in both languages. */
export function publicRoutes(): Route[] {
  const landing = langs.map((lang): Route => ({
    path: lang === 'en' ? '/' : '/vi/',
    lang,
    kind: 'landing',
    title: landingStrings[lang].title,
    description: clamp(landingStrings[lang].description),
  }));
  const docs = langs.flatMap((lang) =>
    slugs.flatMap((slug): Route[] => {
      const page = pages[lang].find((p) => p.slug === slug);
      const raw = rawDocs[`../../../docs/${lang}/${slug}.md`];
      if (!page || raw === undefined) return [];
      return [{
        path: lang === 'en' ? `/docs/${slug}` : `/vi/docs/${slug}`,
        lang,
        kind: 'docs',
        slug,
        title: docsTitle(page.title),
        description: describe(parseFrontmatter(raw).body) || clamp(landingStrings[lang].description),
      }];
    }),
  );
  return [...landing, ...docs];
}
