import { Button } from '@mantine/core';
import type { MouseEvent } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { docsTitle, useTitle } from '../brand';
import { useLang } from '../lib/i18n';
import { DocsLayout } from './DocsLayout';
import { pages } from './loader';

/** Copy buttons are part of the rendered HTML; one delegated handler serves them all. */
function onCopy(ev: MouseEvent<HTMLDivElement>) {
  const btn = (ev.target as HTMLElement).closest('button.copy');
  if (!(btn instanceof HTMLButtonElement)) return;
  const code = btn.closest('figure')?.querySelector('pre code')?.textContent ?? '';
  void navigator.clipboard?.writeText(code).then(() => {
    btn.textContent = 'Copied';
    btn.dataset.copied = '';
    setTimeout(() => {
      btn.textContent = 'Copy';
      delete btn.dataset.copied;
    }, 1400);
  });
}

export function DocsPage() {
  const [lang] = useLang();
  const { page } = useParams();
  const doc = pages[lang].find((p) => p.slug === page);
  useTitle(docsTitle(doc?.title ?? 'Docs'));
  if (!doc) return <Navigate to="/docs/what-it-is" replace />;
  const key = `${lang}/${doc.slug}`;
  return (
    <DocsLayout toc={doc.toc} tocKey={key}>
      {/* Our own Markdown from the repo, rendered at build time: trusted HTML. */}
      <div className="doc" key={key} onClick={onCopy} dangerouslySetInnerHTML={{ __html: doc.html }} />
      {doc.tryIt && (
        <Button component={Link} to={`${doc.tryIt}?trace=1`} size="md" radius="md" className="try-it"
          rightSection={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>}>
          {lang === 'vi' ? 'Thử ngay' : 'Try it'}
        </Button>
      )}
    </DocsLayout>
  );
}
