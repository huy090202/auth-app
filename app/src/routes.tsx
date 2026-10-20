import { Navigate, Route, Routes, useParams } from 'react-router';
import { Title } from '@mantine/core';
import { DemoRoutes } from './app';

// Placeholder: Task 8 fills /docs/:page.
function DocsPage() {
  const { page } = useParams();
  return <Title order={1}>{page}</Title>;
}

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
