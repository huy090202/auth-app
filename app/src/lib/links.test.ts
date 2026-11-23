import { afterEach, describe, expect, it, vi } from 'vitest';

async function load() {
  vi.resetModules();
  return (await import('./links')).portalSignUpUrl;
}

afterEach(() => vi.unstubAllEnvs());

describe('portalSignUpUrl', () => {
  it('defaults to the Portal sign-up page', async () => {
    vi.stubEnv('VITE_PORTAL_URL', undefined);
    expect(await load()).toBe('https://portal.authgatehq.com/sign-up');
  });
  it('drops a trailing slash from the base', async () => {
    vi.stubEnv('VITE_PORTAL_URL', 'https://portal.example.com/');
    expect(await load()).toBe('https://portal.example.com/sign-up');
  });
});
