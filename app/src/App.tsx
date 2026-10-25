import { ActionIcon, Burger, Drawer, SegmentedControl, useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Backdrop, Brand } from './brand';
import { DocsNav } from './docs/DocsLayout';
import { useLang, type Lang } from './lib/i18n';
import { AppRoutes } from './routes';
import { TraceDrawer } from './trace/TraceDrawer';

const icon = { width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

function SchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const scheme = useComputedColorScheme('light');
  const next = scheme === 'dark' ? 'light' : 'dark';
  return (
    <ActionIcon variant="default" size="lg" radius="md" onClick={() => setColorScheme(next)} aria-label={`Switch to ${next} theme`}>
      {next === 'dark' ? (
        <svg viewBox="0 0 24 24" {...icon} aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" {...icon} aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      )}
    </ActionIcon>
  );
}

export function App() {
  const [lang, setLang] = useLang();
  const { pathname } = useLocation();
  const inDocs = pathname.startsWith('/docs');
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => setNavOpen(false), [pathname]);
  return (
    <>
      <Backdrop />
      <header className="site-header glass">
        {inDocs && (
          <Burger opened={navOpen} onClick={() => setNavOpen((o) => !o)} size="sm" hiddenFrom="md"
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'} />
        )}
        <Brand />
        <nav className="topnav" aria-label="Main">
          <Link to="/docs/what-it-is" aria-current={inDocs ? 'page' : undefined}>Docs</Link>
          <Link to="/app/login" aria-current={pathname.startsWith('/app') ? 'page' : undefined}>Demo</Link>
        </nav>
        <div className="header-tools">
          <SegmentedControl size="xs" radius="md" value={lang} onChange={(v) => setLang(v as Lang)} aria-label="Docs language"
            data={[{ label: 'EN', value: 'en' }, { label: 'VI', value: 'vi' }]} />
          <SchemeToggle />
        </div>
      </header>
      <Drawer opened={navOpen && inDocs} onClose={() => setNavOpen(false)} size={300} title={<Brand />}
        classNames={{ content: 'trace-drawer', header: 'trace-drawer-header' }}>
        <DocsNav />
      </Drawer>
      <main>
        <AppRoutes />
      </main>
      <TraceDrawer />
    </>
  );
}
