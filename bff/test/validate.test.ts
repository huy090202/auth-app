import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/lib/http.js';
import { parseEmail, parsePassword, parseUsername } from '../src/users/validate.js';

function rejects(fn: () => unknown, code: string): void {
  assert.throws(fn, (e) => e instanceof AppError && e.status === 400 && e.code === code);
}

test('parseUsername accepts 3–32 of [a-z0-9_.-] and lower-cases', () => {
  assert.equal(parseUsername('Huy.09'), 'huy.09');
  assert.equal(parseUsername('abc'), 'abc');
  assert.equal(parseUsername('a'.repeat(32)), 'a'.repeat(32));
  assert.equal(parseUsername('a_b-c.d'), 'a_b-c.d');
});

test('parseUsername rejects #, spaces, 2 chars, 33 chars, non-string', () => {
  for (const v of ['a#b', 'a b', 'ab', 'a'.repeat(33), 42, null, undefined, {}]) {
    rejects(() => parseUsername(v), 'invalid_username');
  }
});

test('parsePassword rejects < 8 and > 128', () => {
  assert.equal(parsePassword('a'.repeat(8)), 'a'.repeat(8));
  assert.equal(parsePassword('a'.repeat(128)), 'a'.repeat(128));
  rejects(() => parsePassword('a'.repeat(7)), 'invalid_password');
  rejects(() => parsePassword('a'.repeat(129)), 'invalid_password');
  rejects(() => parsePassword(12345678), 'invalid_password');
});

test('parseEmail needs one @, max 254 chars, lower-cases', () => {
  assert.equal(parseEmail('Huy@Example.com'), 'huy@example.com');
  for (const v of ['nope', 'a@@b', '@', 'a@', '@b', `${'a'.repeat(250)}@b.co`, 1]) {
    rejects(() => parseEmail(v), 'invalid_email');
  }
});
