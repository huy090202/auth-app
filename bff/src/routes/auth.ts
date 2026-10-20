import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { decodeJwt } from 'jose';
import type { Deps } from '../app.js';
import { TokenRejectedError, verifyAuthGateToken } from '../authgate/token.js';
import { AppError, jsonOk } from '../lib/http.js';
import { clearSession, issueSession } from '../session/cookie.js';
import { requireSession, type SessionVars } from '../session/middleware.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../users/password.js';
import { parseEmail, parsePassword, parseUsername } from '../users/validate.js';
import { parseFactor, parseId, parseProof, readBody } from './common.js';

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** ULID: 48-bit ms timestamp + 80 random bits, Crockford base32. */
function ulid(now = Date.now()): string {
  let time = '';
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = B32[t % 32] + time;
  const rand = [...randomBytes(16)].map((b) => B32[b % 32]).join('');
  return time + rand;
}

export function authRoutes(deps: Deps): Hono<{ Variables: SessionVars }> {
  const { config, users, authGate, jwks } = deps;
  const secret = config.sessionSecret;
  const r = new Hono<{ Variables: SessionVars }>();

  /** Verify a login token. Its `sub` must equal `subject`. */
  const verifyLoginToken = async (token: string, subject: string) => {
    try {
      return await verifyAuthGateToken(token, {
        jwks,
        issuer: config.authGateBaseUrl,
        audience: config.authGateClientId,
        subject,
        purpose: 'login',
      });
    } catch (e) {
      if (e instanceof TokenRejectedError) throw new AppError(401, 'unauthorized');
      throw e;
    }
  };

  r.post('/register', async (c) => {
    const b = await readBody(c);
    const username = parseUsername(b.username);
    const password = parsePassword(b.password);
    const email = parseEmail(b.email);
    await users.create({
      userId: ulid(),
      username,
      email,
      passwordHash: await hashPassword(password),
      createdAt: new Date().toISOString(),
    });
    return jsonOk(c, 201, { username });
  });

  r.post('/login', async (c) => {
    const b = await readBody(c);
    const username = typeof b.username === 'string' ? b.username.toLowerCase() : '';
    const password = typeof b.password === 'string' ? b.password : '';
    const user = username ? await users.getByUsername(username) : null;
    // Always run scrypt, so an unknown username costs the same as a wrong password.
    const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new AppError(401, 'invalid_credentials');

    const f = await authGate.factors(c.var.trace, user.userId);
    const webauthn = f.webauthn.length > 0;
    if (!f.pin && !webauthn) {
      await issueSession(c, secret, { userId: user.userId, mfa: true });
      return jsonOk(c, 200, { next: 'done' });
    }
    await issueSession(c, secret, { userId: user.userId, mfa: false });
    return jsonOk(c, 200, { next: 'second-factor', factors: { pin: f.pin, webauthn } });
  });

  r.use('/second-factor/*', requireSession(secret, { mfa: false }));

  r.post('/second-factor/start', async (c) => {
    const factor = parseFactor((await readBody(c)).factor);
    const ch = await authGate.createChallenge(c.var.trace, c.var.session.userId, 'login', factor);
    return jsonOk(c, 200, ch);
  });

  r.post('/second-factor/verify', async (c) => {
    const b = await readBody(c);
    const challengeId = parseId(b.challengeId, 'invalid_challenge');
    const userId = c.var.session.userId;
    const v = await authGate.verifyChallenge(c.var.trace, challengeId, parseProof(b));
    await verifyLoginToken(v.token, userId);
    await issueSession(c, secret, { userId, mfa: true });
    return jsonOk(c, 200, { next: 'done' });
  });

  r.post('/passkey/start', async (c) => {
    const b = await readBody(c);
    const username = typeof b.username === 'string' ? b.username.toLowerCase() : '';
    const user = username ? await users.getByUsername(username) : null;
    // Unknown user and user without passkeys answer the same, so usernames cannot be probed.
    if (!user) throw new AppError(409, 'factor_not_enrolled');
    const f = await authGate.factors(c.var.trace, user.userId);
    if (f.webauthn.length === 0) throw new AppError(409, 'factor_not_enrolled');
    const ch = await authGate.createChallenge(c.var.trace, user.userId, 'login', 'webauthn');
    return jsonOk(c, 200, ch);
  });

  r.post('/passkey/verify', async (c) => {
    const b = await readBody(c);
    const challengeId = parseId(b.challengeId, 'invalid_challenge');
    if (b.credential === null || typeof b.credential !== 'object') throw new AppError(400, 'invalid_proof');
    const v = await authGate.verifyChallenge(c.var.trace, challengeId, { credential: b.credential });
    // No session yet: the subject is the one auth-gate signed. Signature, iss, aud,
    // exp and purpose are still checked; then the user must exist here.
    let sub = '';
    try {
      sub = String(decodeJwt(v.token).sub ?? '');
    } catch {
      throw new AppError(401, 'unauthorized');
    }
    await verifyLoginToken(v.token, sub);
    if (!(await users.getById(sub))) throw new AppError(401, 'unauthorized');
    await issueSession(c, secret, { userId: sub, mfa: true });
    return jsonOk(c, 200, { next: 'done' });
  });

  r.post('/logout', (c) => {
    clearSession(c);
    return jsonOk(c, 200, { ok: true });
  });

  return r;
}

