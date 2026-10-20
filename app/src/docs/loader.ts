import { marked } from 'marked';
import type { Lang } from '../lib/i18n';

export type DocPage = { slug: string; lang: Lang; title: string; tryIt?: string; html: string };

export const slugs = [
  'what-it-is', 'setup', 'enroll', '2fa-login', 'passkey-login', 'step-up', 'verify-token', 'errors',
] as const;

/** `---\ntitle: …\ntryIt: …\n---` then the body. Only those two keys. */
export function parseFrontmatter(raw: string): { title: string; tryIt?: string; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!m) return { title: '', body: raw };
  const meta: Record<string, string> = {};
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const out: { title: string; tryIt?: string; body: string } = { title: meta.title ?? '', body: raw.slice(m[0].length) };
  if (meta.tryIt) out.tryIt = meta.tryIt;
  return out;
}

// docs/ also holds infra/ and superpowers/: glob only en/ and vi/ so they stay out of the bundle.
const files = import.meta.glob('../../../docs/{en,vi}/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function load(lang: Lang): DocPage[] {
  return slugs.flatMap((slug) => {
    const raw = files[`../../../docs/${lang}/${slug}.md`];
    if (raw === undefined) return [];
    const { title, tryIt, body } = parseFrontmatter(raw);
    const html = marked.parse(body, { gfm: true, async: false });
    return [tryIt ? { slug, lang, title, tryIt, html } : { slug, lang, title, html }];
  });
}

export const pages: Record<Lang, DocPage[]> = { en: load('en'), vi: load('vi') };
