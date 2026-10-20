import react from '@vitejs/plugin-react';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:8787' },
    // The Markdown pages live in the repo's docs/, outside app/.
    fs: { allow: [searchForWorkspaceRoot(new URL('.', import.meta.url).pathname), '../docs'] },
  },
});
