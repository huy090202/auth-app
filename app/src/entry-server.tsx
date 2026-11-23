import { MantineProvider } from '@mantine/core';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { App } from './App';
import { cssVariablesResolver, theme } from './theme';

export { headFor, urlFor } from './seo/head';
export { publicRoutes } from './seo/routes';

/** The app markup for a path, under the same providers as main.tsx. The browser replaces it with createRoot, never hydration. */
export function render(path: string): string {
  return renderToString(
    <MantineProvider theme={theme} defaultColorScheme="auto" cssVariablesResolver={cssVariablesResolver}>
      <StaticRouter location={path}>
        <App />
      </StaticRouter>
    </MantineProvider>,
  );
}
