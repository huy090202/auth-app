import { describe, expect, it } from 'vitest';
import { langFromPath, localePath, twinPath } from './i18n';

describe('langFromPath', () => {
  it('is vi only for /vi and /vi/...', () => {
    expect(langFromPath('/')).toBe('en');
    expect(langFromPath('/vi')).toBe('vi');
    expect(langFromPath('/vi/')).toBe('vi');
    expect(langFromPath('/vi/docs/a')).toBe('vi');
    expect(langFromPath('/video')).toBe('en');
  });
});

describe('localePath', () => {
  it('adds or leaves the /vi prefix', () => {
    expect(localePath('vi', '/')).toBe('/vi/');
    expect(localePath('vi', '/docs/a')).toBe('/vi/docs/a');
    expect(localePath('en', '/docs/a')).toBe('/docs/a');
  });
});

describe('twinPath', () => {
  it('switches language and keeps search and hash', () => {
    expect(twinPath('/docs/a?x=1#h', 'vi')).toBe('/vi/docs/a?x=1#h');
    expect(twinPath('/vi/', 'en')).toBe('/');
    expect(twinPath('/vi/docs/a#h', 'en')).toBe('/docs/a#h');
    expect(twinPath('/vi', 'en')).toBe('/');
  });
});
