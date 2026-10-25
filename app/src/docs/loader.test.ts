import { describe, expect, it } from 'vitest';
import { pages, parseFrontmatter, renderDoc, slugify, slugs } from './loader';

describe('parseFrontmatter', () => {
  it('reads title and tryIt', () => {
    expect(parseFrontmatter('---\ntitle: Step-up\ntryIt: /app/home\n---\n# Hi\n')).toEqual({
      title: 'Step-up', tryIt: '/app/home', body: '# Hi\n',
    });
  });
  it('leaves tryIt out when absent', () => {
    expect(parseFrontmatter('---\ntitle: A: b\n---\nx')).toEqual({ title: 'A: b', body: 'x' });
  });
  it('passes through text without frontmatter', () => {
    expect(parseFrontmatter('# x')).toEqual({ title: '', body: '# x' });
  });
});

describe('pages', () => {
  it('has the eight slugs in order in both languages, all titled', () => {
    for (const lang of ['en', 'vi'] as const) {
      expect(pages[lang].map((p) => p.slug)).toEqual([...slugs]);
      for (const p of pages[lang]) expect(p.title).not.toBe('');
    }
  });
});

describe('renderDoc', () => {
  it('ids headings and lists h2/h3 in the toc, folding Vietnamese diacritics', () => {
    const { html, toc } = renderDoc('# T\n## Cài đặt `bff`\n### Next\n## Next\n');
    expect(toc).toEqual([
      { id: 'cai-dat-bff', text: 'Cài đặt bff', depth: 2 },
      { id: 'next', text: 'Next', depth: 3 },
      { id: 'next-1', text: 'Next', depth: 2 },
    ]);
    expect(html).toContain('<h2 id="cai-dat-bff">');
    expect(slugify('Lỗi & mã')).toBe('loi-ma');
  });
  it('wraps code in a labelled figure with a copy button', () => {
    const { html } = renderDoc('```text\na <b>\n```\n');
    expect(html).toContain('<span>Diagram</span>');
    expect(html).toContain('class="copy"');
    expect(html).toContain('a &lt;b&gt;');
  });
});
