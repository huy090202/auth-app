import { Hono } from 'hono';
import type { Deps } from '../app.js';
import { TokenRejectedError, verifyAuthGateToken } from '../authgate/token.js';
import { AppError, jsonOk } from '../lib/http.js';
import { requireSession, type SessionVars } from '../session/middleware.js';
import { parseEmail } from '../users/validate.js';
import { parseId, readBody } from './common.js';

export function meRoutes(deps: Deps): Hono<{ Variables: SessionVars }> {
  const { config, users, authGate, jwks } = deps;
  const r = new Hono<{ Variables: SessionVars }>();
  r.use('*', requireSession(config.sessionSecret, { mfa: true }));

  const currentUser = async (userId: string) => {
    const u = await users.getById(userId);
    if (!u) throw new AppError(401, 'unauthorized');
    return u;
  };

  r.get('/', async (c) => {
    const u = await currentUser(c.var.session.userId);
    const factors = await authGate.factors(c.var.trace, u.userId);
    return jsonOk(c, 200, { username: u.username, email: u.email, factors });
  });

  r.post('/pin', async (c) => {
    const b = await readBody(c);
    if (typeof b.pin !== 'string' || b.pin.length === 0) throw new AppError(400, 'invalid_pin');
    await authGate.setPin(c.var.trace, c.var.session.userId, b.pin);
    return jsonOk(c, 201, {});
  });

  r.delete('/pin', async (c) => {
    await authGate.deletePin(c.var.trace, c.var.session.userId);
    return jsonOk(c, 200, {});
  });

  r.post('/passkeys/start', async (c) => {
    const b = await readBody(c).catch(() => ({}) as Record<string, unknown>);
    const displayName = typeof b.displayName === 'string' ? b.displayName : undefined;
    const reg = await authGate.startRegistration(c.var.trace, c.var.session.userId, displayName);
    return jsonOk(c, 200, reg);
  });

  r.post('/passkeys/finish', async (c) => {
    const b = await readBody(c);
    const registrationId = parseId(b.registrationId, 'invalid_registration');
    if (b.credential === null || typeof b.credential !== 'object') throw new AppError(400, 'invalid_proof');
    const out = await authGate.finishRegistration(c.var.trace, registrationId, b.credential);
    return jsonOk(c, 201, out);
  });

  r.delete('/passkeys/:credentialId', async (c) => {
    await authGate.deleteCredential(c.var.trace, c.var.session.userId, c.req.param('credentialId'));
    return jsonOk(c, 200, {});
  });

  r.post('/email', async (c) => {
    const b = await readBody(c);
    const email = parseEmail(b.email);
    const userId = c.var.session.userId;
    try {
      await verifyAuthGateToken(typeof b.stepUpToken === 'string' ? b.stepUpToken : '', {
        jwks,
        issuer: config.authGateBaseUrl,
        audience: config.authGateClientId,
        subject: userId,
        purpose: 'change-email',
      });
    } catch (e) {
      if (e instanceof TokenRejectedError) throw new AppError(403, 'step_up_required');
      throw e;
    }
    await users.updateEmail(userId, email);
    return jsonOk(c, 200, { email });
  });

  return r;
}
