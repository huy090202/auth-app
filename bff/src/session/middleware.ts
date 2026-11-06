import type { MiddlewareHandler } from 'hono';
import { AppError, type Vars } from '../lib/http.js';
import { readSession, type Session } from './cookie.js';

export type SessionVars = Vars & { session: Session };

export function requireSession(
  secret: string,
  opts: { mfa: boolean },
): MiddlewareHandler<{ Variables: SessionVars }> {
  return async (c, next) => {
    const session = await readSession(c, secret);
    if (!session) throw new AppError(401, 'unauthorized');
    if (opts.mfa && !session.mfa) throw new AppError(401, 'second_factor_required');
    // A full session never gets a second challenge.
    if (!opts.mfa && session.mfa) throw new AppError(409, 'already_verified');
    c.set('session', session);
    await next();
  };
}
