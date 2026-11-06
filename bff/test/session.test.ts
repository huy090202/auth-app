import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { AppError, errorHandler, type Vars } from '../src/lib/http.js';
import { SignJWT } from 'jose';
import { COOKIE, issueSession } from '../src/session/cookie.js';
import { requireSession } from '../src/session/middleware.js';

const SECRET = 'test-secret-test-secret-test-secret';

const mk = () => {
  const app = new Hono<{ Variables: Vars }>();
  app.get('/issue-half', async (c) => {
    await issueSession(c, SECRET, { userId: 'u1', mfa: false });
    return c.json({});
  });
  app.get('/issue-full', async (c) => {
    await issueSession(c, SECRET, { userId: 'u1', mfa: true });
    return c.json({});
  });
  app.get('/issue-other', async (c) => {
    await issueSession(c, 'another-secret-another-secret-xx', { userId: 'u1', mfa: true });
    return c.json({});
  });
  app.get('/full', requireSession(SECRET, { mfa: true }), (c) => c.json({ ok: true }));
  app.get('/half', requireSession(SECRET, { mfa: false }), (c) => c.json({ ok: true }));
  app.onError((err, c) => {
    if (!(err instanceof AppError)) throw err;
    return errorHandler(err, c);
  });
  return app;
};

const cookieOf = async (app: ReturnType<typeof mk>, path: string) => {
  const res = await app.request(path);
  const raw = res.headers.get('set-cookie') ?? '';
  return { raw, pair: raw.split(';')[0] ?? '' };
};

const get = (app: ReturnType<typeof mk>, path: string, cookie?: string) =>
  app.request(path, cookie ? { headers: { cookie } } : {});

test('no cookie → 401 unauthorized on both routes', async () => {
  const app = mk();
  for (const p of ['/full', '/half']) {
    const res = await get(app, p);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { error: string }).error, 'unauthorized');
  }
});

test('half session reaches /half and gets 401 second_factor_required on /full', async () => {
  const app = mk();
  const { pair } = await cookieOf(app, '/issue-half');
  assert.equal((await get(app, '/half', pair)).status, 200);
  const res = await get(app, '/full', pair);
  assert.equal(res.status, 401);
  assert.equal(((await res.json()) as { error: string }).error, 'second_factor_required');
});

test('full session reaches /full and gets 409 already_verified on /half', async () => {
  const app = mk();
  const { pair } = await cookieOf(app, '/issue-full');
  assert.equal((await get(app, '/full', pair)).status, 200);
  const res = await get(app, '/half', pair);
  assert.equal(res.status, 409);
  assert.equal(((await res.json()) as { error: string }).error, 'already_verified');
});

test('cookie signed with another secret → 401 unauthorized', async () => {
  const app = mk();
  const { pair } = await cookieOf(app, '/issue-other');
  for (const p of ['/full', '/half']) {
    const res = await get(app, p, pair);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { error: string }).error, 'unauthorized');
  }
});

test('issueSession sets HttpOnly; Secure; SameSite=Lax; Path=/ and Max-Age 600 for half, 43200 for full', async () => {
  const app = mk();
  for (const [path, age] of [['/issue-half', 600], ['/issue-full', 43200]] as const) {
    const { raw } = await cookieOf(app, path);
    assert.ok(raw.startsWith(`${COOKIE}=`));
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /Secure/i);
    assert.match(raw, /SameSite=Lax/i);
    assert.match(raw, /Path=\//);
    assert.match(raw, new RegExp(`Max-Age=${age}(;|$)`));
  }
});

const forge = (claims: Record<string, unknown>, exp: number) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('u1')
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(SECRET));

test('expired cookie signed with the right secret → 401 unauthorized', async () => {
  const app = mk();
  const token = await forge({ mfa: true }, Math.floor(Date.now() / 1000) - 60);
  const res = await get(app, '/full', `${COOKIE}=${token}`);
  assert.equal(res.status, 401);
  assert.equal(((await res.json()) as { error: string }).error, 'unauthorized');
});

test('non-boolean mfa claim → 401 unauthorized, not a full session', async () => {
  const app = mk();
  for (const mfa of ['true', 1, null]) {
    const token = await forge({ mfa }, Math.floor(Date.now() / 1000) + 600);
    const res = await get(app, '/full', `${COOKIE}=${token}`);
    assert.equal(res.status, 401);
    assert.equal(((await res.json()) as { error: string }).error, 'unauthorized');
  }
});
