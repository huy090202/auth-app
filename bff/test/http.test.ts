import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { AppError, errorHandler, jsonOk, type Vars } from '../src/lib/http.js';
import { TraceRecorder } from '../src/lib/trace.js';
import { loadConfig } from '../src/config.js';

const mk = (enabled: boolean, called: boolean) => {
  const app = new Hono<{ Variables: Vars }>();
  app.use(async (c, next) => {
    const t = new TraceRecorder(enabled);
    if (called) t.record({ method: 'GET', path: '/x', requestBody: null, status: 200, responseBody: {}, ms: 1 });
    c.set('trace', t);
    await next();
  });
  app.get('/ok', (c) => jsonOk(c, 200, { a: 1 }));
  app.get('/err', () => {
    throw new AppError(400, 'bad', { error: 'evil', trace: 'evil', more: 1 });
  });
  app.onError(errorHandler);
  return app;
};

test('extras cannot override error or trace', async () => {
  const body = (await (await mk(true, true).request('/err')).json()) as Record<string, unknown>;
  assert.equal(body.error, 'bad');
  assert.equal(body.more, 1);
  assert.ok(Array.isArray(body.trace));
});

test('caller-supplied trace extra is stripped when recorder is disabled', async () => {
  const body = (await (await mk(false, false).request('/err')).json()) as Record<string, unknown>;
  assert.equal('trace' in body, false);
  assert.equal(body.error, 'bad');
});

test('trace is omitted when no auth-gate call was recorded', async () => {
  const body = (await (await mk(true, false).request('/ok')).json()) as Record<string, unknown>;
  assert.deepEqual(body, { a: 1 });
});

test('loadConfig throws on empty session secret and incomplete Lambda env', async () => {
  await assert.rejects(loadConfig({}), /SESSION_SECRET/);
  await assert.rejects(loadConfig({ AWS_LAMBDA_FUNCTION_NAME: 'f', SESSION_SECRET: 's' }), /STAGE/);
});
