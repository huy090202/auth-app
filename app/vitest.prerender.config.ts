import { defineConfig } from 'vitest/config';

// The prerender check reads dist/, so it runs after the build, not in the default suite.
export default defineConfig({ test: { include: ['test-dist/**/*.test.ts'] } });
