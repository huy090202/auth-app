import type { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { SignJWT, jwtVerify } from 'jose';

export type Session = { userId: string; mfa: boolean };

export const COOKIE = 'auth_app_session';

const HALF_SECONDS = 10 * 60;
const FULL_SECONDS = 12 * 60 * 60;

const key = (secret: string) => new TextEncoder().encode(secret);

export async function issueSession(c: Context, secret: string, s: Session): Promise<void> {
  const ttl = s.mfa ? FULL_SECONDS : HALF_SECONDS;
  const token = await new SignJWT({ mfa: s.mfa })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(s.userId)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(key(secret));
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: ttl,
  });
}

export async function readSession(c: Context, secret: string): Promise<Session | null> {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string' || typeof payload.mfa !== 'boolean') return null;
    return { userId: payload.sub, mfa: payload.mfa };
  } catch {
    return null;
  }
}

export function clearSession(c: Context): void {
  deleteCookie(c, COOKIE, { path: '/', secure: true });
}
