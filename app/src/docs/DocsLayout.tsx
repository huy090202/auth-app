import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useLang, type Lang } from '../lib/i18n';
import { pages, type TocItem } from './loader';

const groups: { label: Record<Lang, string>; slugs: string[] }[] = [
  { label: { en: 'Get started', vi: 'Bắt đầu' }, slugs: ['what-it-is', 'checklist', 'setup'] },
  { label: { en: 'Flows', vi: 'Các flow' }, slugs: ['enroll', '2fa-login', 'passkey-login', 'step-up'] },
  { label: { en: 'Reference', vi: 'Tham khảo' }, slugs: ['verify-token', 'api', 'errors'] },
];

/** Grouped page list; used in the sidebar and in the mobile drawer. */
export function DocsNav() {
  const [lang] = useLang();
  const { page } = useParams();
  return (
    <nav aria-label={lang === 'vi' ? 'Tài liệu' : 'Docs'}>
      {groups.map((g) => (
        <div key={g.label.en}>
          <div className="nav-group">{g.label[lang]}</div>
          {g.slugs.map((slug) => {
            const p = pages[lang].find((x) => x.slug === slug);
            return p ? (
              <Link key={slug} to={`/docs/${slug}`} className="nav-link" aria-current={slug === page ? 'page' : undefined}>
                {p.title}
              </Link>
            ) : null;
          })}
        </div>
      ))}
    </nav>
  );
}

/** Scroll-spy: the last heading whose top has passed the header line. */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState(ids[0] ?? '');
  useEffect(() => {
    const onScroll = () => {
      let current = ids[0] ?? '';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top < 120) current = id;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ids]);
  return active;
}

function Toc({ toc, lang }: { toc: TocItem[]; lang: Lang }) {
  const [ids] = useState(() => toc.map((t) => t.id));
  const active = useActiveHeading(ids);
  if (!toc.length) return null;
  return (
    <nav aria-labelledby="toc-title">
      <h2 id="toc-title">{lang === 'vi' ? 'Trong trang này' : 'On this page'}</h2>
      <ul>
        {toc.map((t) => (
          <li key={t.id}>
            <a href={`#${t.id}`} className={`depth-${t.depth}${t.id === active ? ' active' : ''}`}
              aria-current={t.id === active ? 'location' : undefined}>
              {t.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DocsLayout({ children, toc, tocKey }: { children: ReactNode; toc: TocItem[]; tocKey: string }) {
  const [lang] = useLang();
  return (
    <div className={toc.length ? 'docs' : 'docs no-toc'}>
      <aside className="docs-sidebar desktop glass">
        <DocsNav />
      </aside>
      <div className="docs-main">
        <article className="docs-article">{children}</article>
      </div>
      {toc.length > 0 && (
        <aside className="docs-toc">
          <Toc key={tocKey} toc={toc} lang={lang} />
        </aside>
      )}
    </div>
  );
}
