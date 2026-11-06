import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redact, TraceRecorder } from '../src/lib/trace.js';

test('redact hides pin, credential, token and stepUpToken at any depth', () => {
  const out = redact({
    pin: '123456',
    nested: { credential: { id: 'x' } },
    token: 'a'.repeat(40),
    stepUpToken: 'b'.repeat(40),
  });
  assert.deepEqual(out, {
    pin: '***',
    nested: { credential: { redacted: true } },
    token: 'aaaaaaaaaaaaaaaa…',
    stepUpToken: 'bbbbbbbbbbbbbbbb…',
  });
});

test('redact leaves other fields and arrays intact', () => {
  const input = { subjectId: 'u1', factors: ['pin'] };
  const out = redact(input);
  assert.deepEqual(out, { subjectId: 'u1', factors: ['pin'] });
  assert.deepEqual(input, { subjectId: 'u1', factors: ['pin'] });
  assert.notEqual(out, input);
});

const entry = (requestBody: unknown) => ({
  method: 'POST',
  path: '/x',
  requestBody,
  status: 200,
  responseBody: {},
  ms: 1,
});

test('TraceRecorder returns undefined when disabled and entries in order when enabled', () => {
  const off = new TraceRecorder(false);
  off.record(entry({}));
  assert.equal(off.entries(), undefined);
  const on = new TraceRecorder(true);
  on.record({ ...entry({}), path: '/a' });
  on.record({ ...entry({}), path: '/b' });
  assert.deepEqual(on.entries()?.map((e) => e.path), ['/a', '/b']);
});

test('TraceRecorder stores redacted bodies, never the originals', () => {
  const r = new TraceRecorder(true);
  const original = { pin: '1' };
  r.record(entry(original));
  assert.equal((r.entries()?.[0]?.requestBody as { pin: string }).pin, '***');
  assert.equal(original.pin, '1');
});
