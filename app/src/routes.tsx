import { Navigate, Route, Routes } from 'react-router';
import { DemoRoutes } from './app';
import { DocsPage } from './docs/DocsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/docs/what-it-is" replace />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="/app/*" element={<DemoRoutes />} />
      <Route path="*" element={<Navigate to="/docs/what-it-is" replace />} />
    </Routes>
  );
}
