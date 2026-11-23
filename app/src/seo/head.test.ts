import { describe, expect, it } from 'vitest';
import { headFor } from './head';
import { describe as describeDoc } from './describe';
import type { Route } from './routes';

const site = 'https://authgatehq.com';
const base: Route = { path: '/docs/step-up', lang: 'en', kind: 'docs', slug: 'step-up', title: 'Step-up', description: 'A step-up check.' };

describe('headFor', () => {
  it('gives an EN docs page its canonical, alternates and locale', () => {
    const h = headFor(base, site);
    expect(h).toContain('<link rel="canonical" href="https://authgatehq.com/docs/step-up">');
    expect(h).toContain('hreflang="en" href="https://authgatehq.com/docs/step-up"');
    expect(h).toContain('hreflang="vi" href="https://authgatehq.com/vi/docs/step-up"');
    expect(h).toContain('hreflang="x-default" href="https://authgatehq.com/docs/step-up"');
    expect(h).toContain('<meta property="og:locale" content="en_US">');
    expect(h).toContain('<meta property="og:image" content="https://authgatehq.com/og.png">');
  });
  it('gives the VI landing its slash URL', () => {
    const h = headFor({ path: '/vi/', lang: 'vi', kind: 'landing', title: 'T', description: 'D' }, site);
    expect(h).toContain('<link rel="canonical" href="https://authgatehq.com/vi/">');
    expect(h).toContain('hreflang="en" href="https://authgatehq.com/"');
    expect(h).toContain('hreflang="x-default" href="https://authgatehq.com/"');
    expect(h).toContain('content="vi_VN"');
  });
  it('escapes ", < and & in the title and description', () => {
    const h = headFor({ ...base, title: 'A "b" <c> & d', description: 'x "y" <z> & w' }, site);
    expect(h).toContain('<title>A &quot;b&quot; &lt;c&gt; &amp; d</title>');
    expect(h).toContain('<meta name="description" content="x &quot;y&quot; &lt;z&gt; &amp; w">');
    expect(h).toContain('<meta property="og:title" content="A &quot;b&quot; &lt;c&gt; &amp; d">');
    expect(h).not.toMatch(/<c>|<z>/);
  });
});

describe('describeDoc', () => {
  it('cuts a long paragraph at a word boundary, at most 160 characters, with an ellipsis', () => {
    const out = describeDoc('# T\n\n' + 'word '.repeat(60));
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith('…')).toBe(true);
    expect(out).not.toMatch(/\s…$/);
    expect(out.slice(0, -1).split(' ').every((w) => w === 'word')).toBe(true);
  });
  it('leaves a short paragraph alone and strips Markdown', () => {
    expect(describeDoc('# T\n\nUse **bold**, `code` and [a link](/docs/x).\nSecond line.\n\nNext.')).toBe('Use bold, code and a link. Second line.');
  });
  it('skips code, tables and lists and returns empty when there is no paragraph', () => {
    expect(describeDoc('# T\n\n```ts\nx\n```\n\n| a | b |\n\n- item\n\nReal text.')).toBe('Real text.');
    expect(describeDoc('# T\n\n- item\n')).toBe('');
  });
});
