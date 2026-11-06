import { Hono } from 'hono';
import { decodeJwt } from 'jose';
import type { Deps } from '../app.js';
import { TokenRejectedError, verifyAuthGateToken } from '../authgate/token.js';
import { AppError, jsonOk } from '../lib/http.js';
import { requireSession, type SessionVars } from '../session/middleware.js';
import { parseFactor, parseId, parseProof, readBody } from './common.js';

/** Purposes this app performs with a step-up token. */
export const STEP_UP_PURPOSES: readonly string[] = ['change-email'];

export function stepupRoutes(deps: Deps): Hono<{ Variables: SessionVars }> {
  const { config, authGate, jwks } = deps;
  const r = new Hono<{ Variables: SessionVars }>();
  r.use('*', requireSession(config.sessionSecret, { mfa: true }));

  r.post('/start', async (c) => {
    const b = await readBody(c);
    // Checked before auth-gate is called: an unknown purpose never reaches it.
    if (typeof b.purpose !== 'string' || !STEP_UP_PURPOSES.includes(b.purpose)) {
      throw new AppError(400, 'invalid_purpose');
    }
    const factor = parseFactor(b.factor);
    const ch = await authGate.createChallenge(c.var.trace, c.var.session.userId, b.purpose, factor);
    return jsonOk(c, 200, ch);
  });

  r.post('/verify', async (c) => {
    const b = await readBody(c);
    const challengeId = parseId(b.challengeId, 'invalid_challenge');
    const userId = c.var.session.userId;
    const v = await authGate.verifyChallenge(c.var.trace, challengeId, parseProof(b));
    let purpose = '';
    try {
      purpose = String(decodeJwt(v.token).purpose ?? '');
    } catch {
      purpose = '';
    }
    if (!STEP_UP_PURPOSES.includes(purpose)) throw new AppError(403, 'step_up_required');
    try {
      await verifyAuthGateToken(v.token, {
        jwks,
        issuer: config.authGateBaseUrl,
        audience: config.authGateClientId,
        subject: userId,
        purpose,
      });
    } catch (e) {
      if (e instanceof TokenRejectedError) throw new AppError(403, 'step_up_required');
      throw e;
    }
    return jsonOk(c, 200, { stepUpToken: v.token, expiresAt: v.expiresAt });
  });

  return r;
}
