import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AppError } from '../lib/http.js';

export type AuthGateClaims = {
  iss: string;
  sub: string;
  aud: string;
  purpose: string;
  amr: string[];
  jti: string;
  exp: number;
};

export function remoteJwks(baseUrl: string): JWTVerifyGetKey {
  return createRemoteJWKSet(new URL('/.well-known/jwks.json', baseUrl), {
    cooldownDuration: 300_000,
    cacheMaxAge: 300_000,
  });
}

/** Verify an auth-gate step-up token. Any failure is a 403 step_up_required. */
export async function verifyAuthGateToken(
  token: string,
  opts: { jwks: JWTVerifyGetKey; issuer: string; audience: string; subject: string; purpose: string },
): Promise<AuthGateClaims> {
  try {
    const { payload } = await jwtVerify(token, opts.jwks, {
      algorithms: ['ES256'],
      issuer: opts.issuer,
      audience: opts.audience,
    });
    if (payload.sub !== opts.subject || payload.purpose !== opts.purpose) {
      throw new Error('claim mismatch');
    }
    return payload as unknown as AuthGateClaims;
  } catch {
    throw new AppError(403, 'step_up_required');
  }
}
