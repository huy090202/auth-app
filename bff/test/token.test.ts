import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose';
import { TokenRejectedError, verifyAuthGateToken } from '../src/authgate/token.js';

const ISS = 'https://ag.test';
const AUD = 'cl_1';

const keyset = async () => {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
  return { privateKey, jwks: createLocalJWKSet({ keys: [jwk] }) };
};

type Over = { aud?: string; purpose?: string; sub?: string; exp?: number };

const mint = (privateKey: CryptoKey, o: Over = {}) => {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ purpose: o.purpose ?? 'transfer', amr: ['pin'], jti: 'ch_1' })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setIssuer(ISS)
    .setAudience(o.aud ?? AUD)
    .setSubject(o.sub ?? 'u1')
    .setIssuedAt(now - 10)
    .setExpirationTime(o.exp ?? now + 300)
    .sign(privateKey);
};

const expected = { issuer: ISS, audience: AUD, subject: 'u1', purpose: 'transfer' };

const rejects = async (p: Promise<unknown>) =>
  assert.rejects(p, (e) => e instanceof TokenRejectedError);

test('valid token returns its claims', async () => {
  const { privateKey, jwks } = await keyset();
  const claims = await verifyAuthGateToken(await mint(privateKey), { jwks, ...expected });
  assert.equal(claims.sub, 'u1');
  assert.equal(claims.aud, AUD);
  assert.equal(claims.iss, ISS);
  assert.equal(claims.purpose, 'transfer');
  assert.deepEqual(claims.amr, ['pin']);
  assert.equal(claims.jti, 'ch_1');
  assert.equal(typeof claims.exp, 'number');
});

test('token signed by another key → rejected', async () => {
  const { jwks } = await keyset();
  const other = await keyset();
  await rejects(verifyAuthGateToken(await mint(other.privateKey), { jwks, ...expected }));
});

test('wrong aud → rejected', async () => {
  const { privateKey, jwks } = await keyset();
  await rejects(verifyAuthGateToken(await mint(privateKey, { aud: 'cl_2' }), { jwks, ...expected }));
});

test('wrong purpose → rejected', async () => {
  const { privateKey, jwks } = await keyset();
  await rejects(
    verifyAuthGateToken(await mint(privateKey, { purpose: 'change-email' }), { jwks, ...expected }),
  );
});

test('wrong sub → rejected', async () => {
  const { privateKey, jwks } = await keyset();
  await rejects(verifyAuthGateToken(await mint(privateKey, { sub: 'u2' }), { jwks, ...expected }));
});

test('expired token → rejected', async () => {
  const { privateKey, jwks } = await keyset();
  const past = Math.floor(Date.now() / 1000) - 60;
  await rejects(verifyAuthGateToken(await mint(privateKey, { exp: past }), { jwks, ...expected }));
});
