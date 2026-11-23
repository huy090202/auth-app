// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core';
import { renderToString } from 'react-dom/server';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../routes';
import { useLang } from '../lib/i18n';
import { portalSignUpUrl } from '../lib/links';
import { Landing } from './Landing';
import { githubUrl, landingStrings } from './strings';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const render = (path: string) =>
  renderToString(<MantineProvider><MemoryRouter initialEntries={[path]}><Landing /></MemoryRouter></MantineProvider>);

describe('Landing', () => {
  it('EN has the headline, the GitHub and Portal links and the EN what-it-is link', () => {
    const html = render('/');
    expect(html).toContain('A second factor for any backend');
    expect(html).toContain(githubUrl);
    expect(html).toContain(portalSignUpUrl);
    expect(html).toContain('href="/docs/what-it-is"');
  });
  it('VI has the VI headline and the VI what-it-is link', () => {
    const html = render('/vi/');
    expect(html).toContain(landingStrings.vi.headline);
    expect(html).toContain('href="/vi/docs/what-it-is"');
    expect(html).toContain(portalSignUpUrl);
  });
  it('keeps the descriptions within 160 characters', () => {
    expect(landingStrings.en.description.length).toBeLessThanOrEqual(160);
    expect(landingStrings.vi.description.length).toBeLessThanOrEqual(160);
  });
});

describe('stored language on a docs page', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = { 'auth-app.lang': 'vi' };
    // jsdom has neither; Mantine and the docs scroll-spy ask for them.
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
    window.matchMedia = globalThis.matchMedia;
    class IO { observe() {} unobserve() {} disconnect() {} }
    vi.stubGlobal('IntersectionObserver', IO);
    Element.prototype.scrollIntoView = () => {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v; },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('moves to /vi/docs/step-up once, then stays on /docs/step-up after switching to EN', async () => {
    let path = '';
    let setLang: (l: 'en' | 'vi') => void = () => {};
    function Probe() {
      path = useLocation().pathname;
      [, setLang] = useLang();
      return null;
    }
    const el = document.createElement('div');
    const root = createRoot(el);
    await act(async () => {
      root.render(<MantineProvider><MemoryRouter initialEntries={['/docs/step-up']}><Probe /><AppRoutes /></MemoryRouter></MantineProvider>);
    });
    expect(path).toBe('/vi/docs/step-up');
    await act(async () => setLang('en'));
    expect(path).toBe('/docs/step-up');
    await act(async () => {});
    expect(path).toBe('/docs/step-up');
    await act(async () => root.unmount());
  });
});
