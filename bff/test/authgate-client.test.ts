import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthGate } from '../src/authgate/client.js';
import { AppError } from '../src/lib/http.js';
import { TraceRecorder } from '../src/lib/trace.js';

/** The AppError that AuthGate throws for one canned reply. */
const errorFor = async (status: number, body: unknown, headers: Record<string, string> = {}): Promise<AppError> => {
  const fetchFn: typeof fetch = async () => new Response(JSON.stringify(body), { status, headers });
  const client = new AuthGate({ baseUrl: 'https://authgate.test', clientKey: 'ag_test', fetch: fetchFn });
  const err = await client.setPin(new TraceRecorder(false), 'sub_1', '482915').catch((e: unknown) => e);
  assert.ok(err instanceof AppError);
  return err;
};

test('429 rate_limited → AppError 429 rate_limited with retryAfter 7', async () => {
  const err = await errorFor(429, { error: 'rate_limited' }, { 'retry-after': '7' });
  assert.equal(err.status, 429);
  assert.equal(err.code, 'rate_limited');
  assert.deepEqual(err.extras, { retryAfter: 7 });
});

test('429 without Retry-After → no retryAfter', async () => {
  const missing = await errorFor(429, { error: 'rate_limited' });
  assert.equal(missing.status, 429);
  assert.equal(missing.code, 'rate_limited');
  assert.deepEqual(missing.extras, {});

  const unparseable = await errorFor(429, { error: 'rate_limited' }, { 'retry-after': 'Fri, 06 Nov 2026 10:00:00 GMT' });
  assert.equal(unparseable.status, 429);
  assert.deepEqual(unparseable.extras, {});
});

test('another unknown 4xx still maps to 502 authgate_unavailable with upstream', async () => {
  for (const [status, code] of [
    [400, 'wrong_factor'],
    [429, 'slow_down'],
  ] as const) {
    const err = await errorFor(status, { error: code });
    assert.equal(err.status, 502);
    assert.equal(err.code, 'authgate_unavailable');
    assert.deepEqual(err.extras, { upstream: code });
  }
});
