import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { buildApp } from '../src/app.js';
import { AuthGate } from '../src/authgate/client.js';
import type { Config } from '../src/config.js';
import { MemoryUserStore } from '../src/users/store.js';

const ISS = 'https://ag.test';
const AUD = 'cl_1';

const config: Config = {
  stage: '',
  table: 'unused',
  authGateBaseUrl: ISS,
  authGateClientId: AUD,
  authGateClientKey: 'ag_test',
  sessionSecret: 'test-secret-test-secret-test-secret',
  originVerify: null,
  trace: true,
};

type Scripted = (body: unknown, path: string) => { status: number; body: unknown } | Promise<{ status: number; body: unknown }>;

/** A real AuthGate client over a scripted fetch: same class, canned auth-gate replies. */
const harness = async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
  const jwks = createLocalJWKSet({ keys: [jwk] });
  const mint = (o: { sub: string; purpose: string; exp?: number }) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ purpose: o.purpose, amr: ['pin'], jti: 'ch_1' })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setIssuer(ISS)
      .setAudience(AUD)
      .setSubject(o.sub)
      .setIssuedAt(now - 10)
      .setExpirationTime(o.exp ?? now + 300)
      .sign(privateKey);
  };

  const routes = new Map<string, Scripted>();
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });
    const key = `${method} ${url.pathname.replace(/\/api\/factors\/(?!pin)[^/]+$/, '/api/factors/:id')}`;
    const h = routes.get(key);
    if (!h) return new Response(JSON.stringify({ error: 'unscripted' }), { status: 500 });
    const r = await h(body, url.pathname);
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
  const authGate = new AuthGate({ baseUrl: ISS, clientKey: 'ag_test', fetch: fetchFn });
  const users = new MemoryUserStore();
  const app = buildApp({ config, users, authGate, jwks });
  return { app, users, routes, calls, mint };
};

type H = Awaited<ReturnType<typeof harness>>;

const call = async (h: H, method: string, path: string, body?: unknown, cookie?: string) => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie) headers.cookie = cookie;
  const res = await h.app.request(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = res.headers.get('set-cookie') ?? '';
  return { status: res.status, json: (await res.json()) as Record<string, unknown>, cookie: setCookie.split(';')[0] ?? '' };
};

const noFactors = (h: H) => h.routes.set('GET /api/factors/:id', () => ({ status: 200, body: { pin: false, webauthn: [] } }));
const pinFactor = (h: H) => h.routes.set('GET /api/factors/:id', () => ({ status: 200, body: { pin: true, webauthn: [] } }));

const register = (h: H, username = 'alice') =>
  call(h, 'POST', '/api/auth/register', { username, password: 'correct horse', email: `${username}@ex.test` });

const login = (h: H, username = 'alice', password = 'correct horse') =>
  call(h, 'POST', '/api/auth/login', { username, password });

const fullSession = async (h: H) => {
  await register(h);
  noFactors(h);
  const r = await login(h);
  assert.equal(r.json.next, 'done');
  return r.cookie;
};

const userIdOf = async (h: H) => (await h.users.getByUsername('alice'))!.userId;

test('register then login without factors → next done and a full cookie', async () => {
  const h = await harness();
  const reg = await register(h);
  assert.equal(reg.status, 201);
  noFactors(h);
  const r = await login(h);
  assert.equal(r.status, 200);
  assert.equal(r.json.next, 'done');
  assert.ok(r.cookie.startsWith('auth_app_session='));
  const me = await call(h, 'GET', '/api/me', undefined, r.cookie);
  assert.equal(me.status, 200);
  assert.equal(me.json.username, 'alice');
  assert.equal(me.json.email, 'alice@ex.test');
});

test('register twice → 409 username_taken', async () => {
  const h = await harness();
  await register(h);
  const r = await register(h);
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'username_taken');
});

test('login unknown username → 401 invalid_credentials with no next', async () => {
  const h = await harness();
  const r = await login(h, 'nobody');
  assert.equal(r.status, 401);
  assert.equal(r.json.error, 'invalid_credentials');
  assert.equal(r.json.next, undefined);
  assert.equal(r.cookie, '');
  await register(h);
  const wrong = await login(h, 'alice', 'wrong password');
  assert.equal(wrong.status, 401);
  assert.deepEqual(wrong.json, r.json);
  const malformed = await login(h, 'x'.repeat(500));
  assert.equal(malformed.status, 401);
  assert.deepEqual(malformed.json, r.json);
  assert.equal(h.calls.length, 0);
});

test('login with a pin factor → next second-factor and a half cookie; /api/me → 401 second_factor_required', async () => {
  const h = await harness();
  await register(h);
  pinFactor(h);
  const r = await login(h);
  assert.equal(r.json.next, 'second-factor');
  assert.deepEqual(r.json.factors, { pin: true, webauthn: false });
  const me = await call(h, 'GET', '/api/me', undefined, r.cookie);
  assert.equal(me.status, 401);
  assert.equal(me.json.error, 'second_factor_required');
});

test('second-factor/start with a full session → 409 already_verified', async () => {
  const h = await harness();
  const cookie = await fullSession(h);
  const r = await call(h, 'POST', '/api/auth/second-factor/start', { factor: 'pin' }, cookie);
  assert.equal(r.status, 409);
  assert.equal(r.json.error, 'already_verified');
});

test('second-factor/verify success upgrades the cookie; /api/me then 200', async () => {
  const h = await harness();
  await register(h);
  pinFactor(h);
  const half = (await login(h)).cookie;
  const uid = await userIdOf(h);
  h.routes.set('POST /api/challenges', () => ({ status: 201, body: { challengeId: 'ch_1', expiresAt: 'later' } }));
  h.routes.set('POST /api/challenges/ch_1/verify', async () => ({
    status: 200,
    body: { token: await h.mint({ sub: uid, purpose: 'login' }), expiresAt: 'later', factor: 'pin' },
  }));
  const start = await call(h, 'POST', '/api/auth/second-factor/start', { factor: 'pin' }, half);
  assert.equal(start.status, 200);
  assert.equal(start.json.challengeId, 'ch_1');
  assert.deepEqual(h.calls.at(-1)?.body, { subjectId: uid, purpose: 'login', factor: 'pin' });
  const v = await call(h, 'POST', '/api/auth/second-factor/verify', { challengeId: 'ch_1', pin: '123456' }, half);
  assert.equal(v.status, 200);
  assert.ok(v.cookie.startsWith('auth_app_session='));
  const me = await call(h, 'GET', '/api/me', undefined, v.cookie);
  assert.equal(me.status, 200);
});

test('passkey/start unknown username and user without passkeys → same 409 factor_not_enrolled', async () => {
  const h = await harness();
  await register(h);
  noFactors(h);
  const known = await call(h, 'POST', '/api/auth/passkey/start', { username: 'alice' });
  const unknown = await call(h, 'POST', '/api/auth/passkey/start', { username: 'nobody' });
  const malformed = await call(h, 'POST', '/api/auth/passkey/start', { username: 'x'.repeat(500) });
  assert.equal(config.trace, true);
  for (const r of [known, unknown, malformed]) {
    assert.equal(r.status, 409);
    assert.deepEqual(r.json, { error: 'factor_not_enrolled' });
  }
});

test('stepup/start purpose delete-account → 400 invalid_purpose and the fake auth-gate was not called', async () => {
  const h = await harness();
  const cookie = await fullSession(h);
  const before = h.calls.length;
  const r = await call(h, 'POST', '/api/stepup/start', { purpose: 'delete-account', factor: 'pin' }, cookie);
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'invalid_purpose');
  assert.equal(h.calls.length, before);
});

test('me/email with a token for another sub, another purpose, or expired → 403 step_up_required; email unchanged', async () => {
  const h = await harness();
  const cookie = await fullSession(h);
  const uid = await userIdOf(h);
  const past = Math.floor(Date.now() / 1000) - 60;
  const bad = [
    await h.mint({ sub: 'someone-else', purpose: 'change-email' }),
    await h.mint({ sub: uid, purpose: 'login' }),
    await h.mint({ sub: uid, purpose: 'change-email', exp: past }),
  ];
  for (const stepUpToken of bad) {
    const r = await call(h, 'POST', '/api/me/email', { email: 'new@ex.test', stepUpToken }, cookie);
    assert.equal(r.status, 403);
    assert.equal(r.json.error, 'step_up_required');
  }
  assert.equal((await h.users.getById(uid))!.email, 'alice@ex.test');
  const ok = await call(
    h,
    'POST',
    '/api/me/email',
    { email: 'new@ex.test', stepUpToken: await h.mint({ sub: uid, purpose: 'change-email' }) },
    cookie,
  );
  assert.equal(ok.status, 200);
  assert.equal((await h.users.getById(uid))!.email, 'new@ex.test');
});

test('responses that called auth-gate carry trace with redacted pin', async () => {
  const h = await harness();
  const cookie = await fullSession(h);
  h.routes.set('POST /api/factors/pin', () => ({ status: 201, body: {} }));
  const r = await call(h, 'POST', '/api/me/pin', { pin: '123456' }, cookie);
  assert.equal(r.status, 201);
  const trace = r.json.trace as { path: string; requestBody: { pin: string } }[];
  assert.equal(trace[0]?.path, '/api/factors/pin');
  assert.equal(trace[0]?.requestBody.pin, '***');
  assert.equal(h.calls.at(-1)?.body && (h.calls.at(-1)!.body as { pin: string }).pin, '123456');
});

test('GET /api/nope → 404 not_found JSON', async () => {
  const h = await harness();
  const r = await call(h, 'GET', '/api/nope');
  assert.equal(r.status, 404);
  assert.equal(r.json.error, 'not_found');
});
