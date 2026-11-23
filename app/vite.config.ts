import react from '@vitejs/plugin-react';
import { searchForWorkspaceRoot } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
    // The Markdown pages live in the repo's docs/, outside app/.
    fs: { allow: [searchForWorkspaceRoot(new URL('.', import.meta.url).pathname), '../docs'] },
  },
  test: { exclude: [...configDefaults.exclude, 'test-dist/**'] },
});
