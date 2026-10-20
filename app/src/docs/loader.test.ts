import { describe, expect, it } from 'vitest';
import { pages, parseFrontmatter, slugs } from './loader';

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
