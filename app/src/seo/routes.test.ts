import { describe, expect, it } from 'vitest';
import { pages } from '../docs/loader';
import { publicRoutes } from './routes';

describe('publicRoutes', () => {
  const routes = publicRoutes();
  it('has two landings and every docs page in both languages', () => {
    expect(routes.filter((r) => r.kind === 'landing').map((r) => r.path)).toEqual(['/', '/vi/']);
    expect(routes.length).toBe(2 + pages.en.length + pages.vi.length);
    expect(routes.map((r) => r.path)).toContain('/vi/docs/step-up');
  });
  it('keeps every description within 160 characters and never empty', () => {
    for (const r of routes) {
      expect(r.description.length, r.path).toBeGreaterThan(0);
      expect(r.description.length, r.path).toBeLessThanOrEqual(160);
    }
  });
});
