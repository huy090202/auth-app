import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { DemoRoutes } from './app';
import { DocsPage } from './docs/DocsPage';
import { Landing } from './landing/Landing';
import { isLocaleRoute, langFromPath, localePath, storedLang, twinPath } from './lib/i18n';

/** A visitor who chose VI before lands on the VI twin of an EN landing or docs page, once per navigation. Never the other way. */
function StoredLangRedirect() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (isLocaleRoute(pathname) && langFromPath(pathname) === 'en' && storedLang() === 'vi') {
      navigate(twinPath(pathname + search + hash, 'vi'), { replace: true });
    }
    // Only a new path counts as a navigation; the redirect lands on a /vi path, so it cannot loop.
  }, [pathname]);
  return null;
}

function Fallback() {
  const { pathname } = useLocation();
  return <Navigate to={localePath(langFromPath(pathname), '/docs/what-it-is')} replace />;
}

export function AppRoutes() {
  return (
    <>
      <StoredLangRedirect />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/vi" element={<Landing />} />
        <Route path="/docs/:page" element={<DocsPage />} />
        <Route path="/vi/docs/:page" element={<DocsPage />} />
        <Route path="/app/*" element={<DemoRoutes />} />
        <Route path="*" element={<Fallback />} />
      </Routes>
    </>
  );
}
