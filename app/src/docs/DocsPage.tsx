import { Button, TypographyStylesProvider } from '@mantine/core';
import './docs.css';
import { useEffect, useRef } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useLang } from '../lib/i18n';
import { DocsLayout } from './DocsLayout';
import { pages } from './loader';

/** Adds a Copy button to every code block in the rendered HTML. */
function useCopyButtons(ref: React.RefObject<HTMLDivElement | null>, key: string) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    for (const pre of root.querySelectorAll('pre')) {
      if (pre.querySelector('button.copy')) continue;
      const btn = document.createElement('button');
      btn.className = 'copy';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.onclick = () => {
        void navigator.clipboard?.writeText(pre.querySelector('code')?.textContent ?? '').then(() => {
          btn.textContent = 'Copied';
          setTimeout(() => (btn.textContent = 'Copy'), 1200);
        });
      };
      pre.style.position = 'relative';
      pre.appendChild(btn);
    }
  }, [ref, key]);
}

export function DocsPage() {
  const [lang] = useLang();
  const { page } = useParams();
  const ref = useRef<HTMLDivElement>(null);
  const doc = pages[lang].find((p) => p.slug === page);
  useCopyButtons(ref, `${lang}/${page}`);
  if (!doc) return <Navigate to="/docs/what-it-is" replace />;
  return (
    <DocsLayout>
      <TypographyStylesProvider className="doc">
        {/* Our own Markdown from the repo, rendered at build time: trusted HTML. */}
        <div ref={ref} key={`${lang}/${doc.slug}`} dangerouslySetInnerHTML={{ __html: doc.html }} />
      </TypographyStylesProvider>
      {doc.tryIt && (
        <Button component={Link} to={`${doc.tryIt}?trace=1`} mt="lg">
          {lang === 'vi' ? 'Thử ngay' : 'Try it'}
        </Button>
      )}
    </DocsLayout>
  );
}
