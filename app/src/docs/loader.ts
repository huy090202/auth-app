import { Marked, type Tokens } from 'marked';
import type { Lang } from '../lib/i18n';
import { highlight } from './highlight';

export type TocItem = { id: string; text: string; depth: 2 | 3 };
export type DocPage = { slug: string; lang: Lang; title: string; tryIt?: string; html: string; toc: TocItem[] };

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

/** Heading text to an ASCII id. Vietnamese diacritics fold to plain letters. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/<[^>]*>/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const langLabel: Record<string, string> = { ts: 'TypeScript', bash: 'Bash', json: 'JSON', text: 'Diagram' };

/** Markdown to HTML plus a table of contents from its h2/h3. */
export function renderDoc(body: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const seen = new Map<string, number>();
  const md = new Marked({ gfm: true, async: false });
  md.use({
    renderer: {
      heading(this: { parser: { parseInline(t: Tokens.Generic[]): string } }, { tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text) || 'section';
        const n = seen.get(id) ?? 0;
        seen.set(id, n + 1);
        if (n) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) toc.push({ id, text: inner.replace(/<[^>]*>/g, ''), depth });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      code({ text, lang }: Tokens.Code) {
        const key = (lang ?? '').trim().split(/\s/)[0] ?? '';
        const label = langLabel[key] ?? (key || 'Text');
        const code = highlight(text, key) ?? esc(text);
        return `<figure class="code" data-lang="${esc(key || 'text')}"><figcaption><span>${esc(label)}</span>`
          + `<button type="button" class="copy" aria-label="Copy ${esc(label)} code">Copy</button></figcaption>`
          + `<pre><code class="hljs">${code}</code></pre></figure>\n`;
      },
    },
  });
  return { html: md.parse(body) as string, toc };
}

// docs/ also holds infra/ and superpowers/: glob only en/ and vi/ so they stay out of the bundle.
const files = import.meta.glob('../../../docs/{en,vi}/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function load(lang: Lang): DocPage[] {
  return slugs.flatMap((slug) => {
    const raw = files[`../../../docs/${lang}/${slug}.md`];
    if (raw === undefined) return [];
    const { title, tryIt, body } = parseFrontmatter(raw);
    const { html, toc } = renderDoc(body);
    return [tryIt ? { slug, lang, title, tryIt, html, toc } : { slug, lang, title, html, toc }];
  });
}

export const pages: Record<Lang, DocPage[]> = { en: load('en'), vi: load('vi') };
