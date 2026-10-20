import { Navigate, Route, Routes, useParams } from 'react-router';
import { Text, Title } from '@mantine/core';

// Placeholders: Task 8 fills /docs/:page, Task 7 fills /app/*.
function DocsPage() {
  const { page } = useParams();
  return <Title order={1}>{page}</Title>;
}

function DemoPage() {
  return <Text>Demo screens land here.</Text>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/docs/what-it-is" replace />} />
      <Route path="/docs/:page" element={<DocsPage />} />
      <Route path="/app/*" element={<DemoPage />} />
      <Route path="*" element={<Navigate to="/docs/what-it-is" replace />} />
    </Routes>
  );
}
